import hashlib
import os
import uuid
from typing import List, Optional, Tuple
from fastapi import UploadFile, HTTPException, status
from sqlalchemy import select, func, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.services.extraction_service import ExtractionService, ExtractionError
from app.storage import get_storage


class DocumentService:
    def __init__(self, storage=None):
        self.storage = storage or get_storage()

    async def list_documents(
        self,
        db: AsyncSession,
        user_id: str,
        page: int = 1,
        size: int = 10,
        status_filter: Optional[str] = None,
        search_query: Optional[str] = None,
    ) -> Tuple[List[Document], int]:
        """Lists documents for user with pagination, status filter, and keyword search."""
        query = select(Document).where(Document.user_id == user_id)
        count_query = select(func.count(Document.id)).where(Document.user_id == user_id)

        if status_filter:
            if status_filter == "processing":
                query = query.where(Document.status.in_(["processing", "queued", "uploaded"]))
                count_query = count_query.where(Document.status.in_(["processing", "queued", "uploaded"]))
            else:
                query = query.where(Document.status == status_filter)
                count_query = count_query.where(Document.status == status_filter)

        if search_query:
            term = f"%{search_query.strip().lower()}%"
            query = query.where(
                func.lower(Document.title).like(term) | func.lower(Document.filename).like(term)
            )
            count_query = count_query.where(
                func.lower(Document.title).like(term) | func.lower(Document.filename).like(term)
            )

        total_res = await db.execute(count_query)
        total = total_res.scalar() or 0

        query = query.order_by(Document.created_at.desc()).offset((page - 1) * size).limit(size)
        res = await db.execute(query)
        items = list(res.scalars().all())

        return items, total

    async def get_document(self, db: AsyncSession, document_id: str, user_id: str) -> Optional[Document]:
        """Retrieves single document enforcing user ownership."""
        stmt = select(Document).where(and_(Document.id == document_id, Document.user_id == user_id))
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_document(
        self,
        db: AsyncSession,
        user_id: str,
        upload_file: UploadFile,
    ) -> Document:
        """Validates, stores, records document in database, and commits before dispatching Celery task."""
        # 1. Validate file extension
        filename = upload_file.filename or "unknown.pdf"
        ext = os.path.splitext(filename)[1].lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '{ext}'. Allowed extensions are: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )

        # 2. Read and validate file content
        content = await upload_file.read()
        file_size = len(content)

        max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size ({file_size / (1024 * 1024):.1f}MB) exceeds limit of {settings.MAX_FILE_SIZE_MB}MB."
            )

        try:
            mime_type = ExtractionService.validate_file_content(content, filename)
        except ExtractionError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        # 3. Compute SHA-256 hash
        file_hash = hashlib.sha256(content).hexdigest()

        # 4. Save file to storage
        doc_id = str(uuid.uuid4())
        storage_rel_path = f"users/{user_id}/docs/{doc_id}_{filename}"
        stored_path = self.storage.save(content, storage_rel_path)

        # 5. Create Document record
        doc = Document(
            id=doc_id,
            user_id=user_id,
            title=os.path.splitext(filename)[0],
            filename=filename,
            file_path=stored_path,
            file_size=file_size,
            mime_type=mime_type,
            file_hash=file_hash,
            status="uploaded",
            metadata_json={
                "original_name": filename,
                "extension": ext,
                "progress": 10,
                "stage": "queued",
            },
        )
        db.add(doc)
        # CRITICAL: Commit transaction before dispatching task to avoid race condition!
        await db.commit()
        await db.refresh(doc)

        # 6. Dispatch Celery background task
        self.dispatch_processing_task(doc.id)

        return doc

    def dispatch_processing_task(self, document_id: str):
        """Dispatches Celery ingestion task with graceful handling if broker is offline."""
        try:
            from app.workers.tasks import process_document_task
            if settings.CELERY_TASK_ALWAYS_EAGER or settings.ENVIRONMENT == "test":
                process_document_task.apply(args=[document_id])
            else:
                process_document_task.apply_async(args=[document_id], retry=False)
            logger.info(f"Dispatched Celery task for document {document_id}")
        except Exception as e:
            logger.warning(f"Could not dispatch Celery task: {e}. Document status remains queued.")

    async def retry_processing(self, db: AsyncSession, document_id: str, user_id: str) -> Document:
        """Safely retries processing for a failed document."""
        doc = await self.get_document(db, document_id, user_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

        # Clean up any partial chunks from previous run
        await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
        doc.status = "queued"
        doc.error_message = None
        doc.chunk_count = 0
        doc.page_count = 0
        current_meta = dict(doc.metadata_json or {})
        current_meta.update({"progress": 10, "stage": "queued"})
        doc.metadata_json = current_meta
        await db.commit()
        await db.refresh(doc)

        self.dispatch_processing_task(doc.id)
        return doc

    async def delete_document(self, db: AsyncSession, document_id: str, user_id: str) -> bool:
        """Deletes document, chunks, and storage file."""
        doc = await self.get_document(db, document_id, user_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

        file_path = doc.file_path
        # Delete from DB (chunks cascade deleted)
        await db.delete(doc)
        await db.commit()

        # Delete physical file from storage
        self.storage.delete(file_path)
        return True

    async def get_document_bytes(self, db: AsyncSession, document_id: str, user_id: str) -> Tuple[bytes, Document]:
        """Retrieves raw document bytes from storage for preview or secure download."""
        doc = await self.get_document(db, document_id, user_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

        content = self.storage.load(doc.file_path)
        return content, doc

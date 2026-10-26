import math
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_async_db
from app.models.user import User
from app.schemas.document import DocumentListResponse, DocumentResponse, DocumentRetryResponse
from app.services.document_service import DocumentService

router = APIRouter()
doc_service = DocumentService()


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Lists documents with pagination, optional status filtering, and search."""
    items, total = await doc_service.list_documents(
        db=db,
        user_id=current_user.id,
        page=page,
        size=size,
        status_filter=status,
        search_query=q,
    )
    pages = math.ceil(total / size) if size > 0 else 1
    return DocumentListResponse(
        items=[DocumentResponse.model_validate(doc) for doc in items],
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Uploads a PDF or DOCX document and triggers asynchronous extraction and embedding."""
    doc = await doc_service.create_document(
        db=db,
        user_id=current_user.id,
        upload_file=file,
    )
    return DocumentResponse.model_validate(doc)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Fetches details and real processing status of a single document."""
    doc = await doc_service.get_document(db=db, document_id=document_id, user_id=current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return DocumentResponse.model_validate(doc)


@router.post("/{document_id}/retry", response_model=DocumentRetryResponse)
async def retry_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Retries processing for a failed document safely."""
    doc = await doc_service.retry_processing(db=db, document_id=document_id, user_id=current_user.id)
    return DocumentRetryResponse(
        id=doc.id,
        status=doc.status,
        message="Document processing re-queued successfully.",
    )


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Deletes document, associated chunks, vector embeddings, and physical storage file."""
    await doc_service.delete_document(db=db, document_id=document_id, user_id=current_user.id)
    return {"message": "Document deleted successfully."}


@router.get("/{document_id}/preview")
async def preview_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Retrieves document raw bytes for secure browser preview."""
    content, doc = await doc_service.get_document_bytes(db=db, document_id=document_id, user_id=current_user.id)
    return Response(
        content=content,
        media_type=doc.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{doc.filename}"'
        }
    )


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Securely downloads the exact original uploaded file preserving original filename and MIME type."""
    content, doc = await doc_service.get_document_bytes(db=db, document_id=document_id, user_id=current_user.id)
    return Response(
        content=content,
        media_type=doc.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{doc.filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/{document_id}/chunks")
async def get_document_chunks(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Retrieves parsed text chunks for inline document review and mobile reader mode."""
    from sqlalchemy import select
    from app.models.chunk import DocumentChunk

    doc = await doc_service.get_document(db=db, document_id=document_id, user_id=current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    stmt = select(DocumentChunk).where(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index)
    res = await db.execute(stmt)
    chunks = res.scalars().all()

    return {
        "document_id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "page_count": doc.page_count,
        "chunks": [
            {
                "id": c.id,
                "chunk_index": c.chunk_index,
                "page_number": c.page_number,
                "content": c.content,
            }
            for c in chunks
        ],
    }

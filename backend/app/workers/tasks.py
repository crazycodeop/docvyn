from celery import Task
from sqlalchemy import select, delete
from app.core.logging import logger
from app.db.session import get_sync_db
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.services.chunking_service import ChunkingService
from app.services.embedding_service import EmbeddingService
from app.services.extraction_service import (
    ExtractionService,
    ExtractionError,
    CorruptFileError,
    EmptyDocumentError,
)
from app.storage import get_storage
from app.workers.celery_app import celery_app


class IngestionTask(Task):
    autoretry_for = (ConnectionError, TimeoutError)
    retry_kwargs = {"max_retries": 3, "countdown": 5}
    retry_backoff = True


@celery_app.task(bind=True, base=IngestionTask, name="process_document_task")
def process_document_task(self, document_id: str):
    """Processes document: extracts text, chunks, computes embeddings, and stores in database."""
    logger.info(f"[Task {self.request.id}] Starting processing for document {document_id}")
    db = get_sync_db()
    storage = get_storage()

    try:
        # 1. Fetch document record
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            logger.error(f"Document {document_id} not found in database.")
            return {"status": "error", "message": "Document not found"}

        # Idempotency check: if already completed, do nothing
        if doc.status == "completed" and doc.chunk_count > 0:
            logger.info(f"Document {document_id} is already completed. Skipping.")
            return {"status": "skipped", "message": "Already completed"}

        # 2. Stage: Queued -> Extracting
        doc.status = "processing"
        doc.error_message = None
        current_meta = dict(doc.metadata_json or {})
        current_meta.update({"progress": 25, "stage": "extracting"})
        doc.metadata_json = current_meta
        db.commit()

        # 3. Read file from storage
        file_bytes = storage.load(doc.file_path)

        # 4. Extract pages (handles digital PDF, hybrid OCR PDF, images, DOCX)
        pages = ExtractionService.extract(file_bytes, doc.filename)
        doc.page_count = len(pages)

        # Determine dominant extraction method and avg OCR confidence from pages
        extraction_methods = [p.metadata.get("extraction_method", "unknown") for p in pages]
        ocr_confidences = [
            p.metadata.get("ocr_confidence")
            for p in pages
            if p.metadata.get("ocr_confidence") is not None
        ]
        has_ocr = any("ocr" in m for m in extraction_methods)
        dominant_method = (
            "ocr"
            if has_ocr
            else (extraction_methods[0] if extraction_methods else "digital")
        )
        avg_ocr_conf = (
            round(sum(ocr_confidences) / len(ocr_confidences), 3)
            if ocr_confidences
            else 1.0
        )

        # If OCR was performed, update stage to reflect it
        current_meta = dict(doc.metadata_json or {})
        current_meta.update({
            "progress": 50 if has_ocr else 40,
            "stage": "ocr" if has_ocr else "extracted",
            "extraction_method": dominant_method,
            "ocr_confidence": avg_ocr_conf,
        })
        doc.metadata_json = current_meta
        db.commit()

        # 5. Stage: Chunking
        current_meta = dict(doc.metadata_json or {})
        current_meta.update({"progress": 65, "stage": "chunking"})
        doc.metadata_json = current_meta
        db.commit()

        chunking_svc = ChunkingService()
        chunks_data = chunking_svc.chunk_pages(pages)

        if not chunks_data:
            raise EmptyDocumentError("No text chunks could be generated from document.")

        # 6. Stage: Embedding
        current_meta = dict(doc.metadata_json or {})
        current_meta.update({"progress": 85, "stage": "embedding"})
        doc.metadata_json = current_meta
        db.commit()

        embedding_svc = EmbeddingService()
        texts = [c.content for c in chunks_data]
        embeddings = embedding_svc.get_embeddings_batch(texts)

        # 7. Store chunks and update status atomically
        # Clean up any partial chunks from prior failed attempts (idempotent)
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()

        chunk_records = []
        for c_data, emb in zip(chunks_data, embeddings):
            chunk_records.append(
                DocumentChunk(
                    document_id=doc.id,
                    chunk_index=c_data.chunk_index,
                    content=c_data.content,
                    page_number=c_data.page_number,
                    token_count=c_data.token_count,
                    embedding=emb,
                    metadata_json=c_data.metadata,
                )
            )

        db.bulk_save_objects(chunk_records)
        doc.chunk_count = len(chunk_records)
        doc.status = "completed"
        doc.error_message = None

        current_meta = dict(doc.metadata_json or {})
        current_meta.update({
            "progress": 100,
            "stage": "completed",
            "extraction_method": dominant_method,
            "ocr_confidence": avg_ocr_conf,
        })
        doc.metadata_json = current_meta
        db.commit()

        logger.info(
            f"Successfully processed document {document_id}: {doc.page_count} pages, {doc.chunk_count} chunks (method: {dominant_method})."
        )
        return {
            "status": "completed",
            "document_id": document_id,
            "pages": doc.page_count,
            "chunks": doc.chunk_count,
            "extraction_method": dominant_method,
        }

    except (CorruptFileError, EmptyDocumentError, ExtractionError) as e:
        logger.error(f"Permanent document processing failure for {document_id}: {e}")
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.status = "failed"
            doc.error_message = str(e)
            current_meta = dict(doc.metadata_json or {})
            current_meta.update({"progress": 0, "stage": "failed"})
            doc.metadata_json = current_meta
            db.commit()
        return {"status": "failed", "error": str(e)}

    except Exception as e:
        logger.exception(f"Unexpected error processing document {document_id}: {e}")
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.status = "failed"
            doc.error_message = f"Processing error: {str(e)}"
            current_meta = dict(doc.metadata_json or {})
            current_meta.update({"progress": 0, "stage": "failed"})
            doc.metadata_json = current_meta
            db.commit()
        raise e

    finally:
        db.close()

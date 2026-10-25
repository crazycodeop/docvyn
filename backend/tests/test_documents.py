import io
import pytest
from httpx import AsyncClient
from reportlab.pdfgen import canvas


def create_sample_pdf_bytes():
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(100, 750, "DocRAG Document API Test Content.")
    c.save()
    return buf.getvalue()


@pytest.mark.asyncio
async def test_document_lifecycle_api(client: AsyncClient, auth_headers: dict):
    # 1. Upload valid PDF
    pdf_bytes = create_sample_pdf_bytes()
    files = {"file": ("api_test.pdf", pdf_bytes, "application/pdf")}
    upload_resp = await client.post("/api/v1/documents/upload", files=files, headers=auth_headers)
    assert upload_resp.status_code == 200, upload_resp.text
    doc_data = upload_resp.json()
    assert doc_data["filename"] == "api_test.pdf"
    assert doc_data["status"] == "uploaded"
    doc_id = doc_data["id"]

    # 2. Get document details
    get_resp = await client.get(f"/api/v1/documents/{doc_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == doc_id

    # 3. List documents
    list_resp = await client.get("/api/v1/documents", headers=auth_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    assert len(items) >= 1
    assert any(d["id"] == doc_id for d in items)

    # 4. Preview document
    preview_resp = await client.get(f"/api/v1/documents/{doc_id}/preview", headers=auth_headers)
    assert preview_resp.status_code == 200
    assert preview_resp.headers["content-type"] == "application/pdf"
    assert len(preview_resp.content) == len(pdf_bytes)

    # 5. Retry document processing
    retry_resp = await client.post(f"/api/v1/documents/{doc_id}/retry", headers=auth_headers)
    assert retry_resp.status_code == 200
    assert retry_resp.json()["status"] == "queued"

    # 6. Delete document
    del_resp = await client.delete(f"/api/v1/documents/{doc_id}", headers=auth_headers)
    assert del_resp.status_code == 200

    # 7. Verify deletion
    verify_resp = await client.get(f"/api/v1/documents/{doc_id}", headers=auth_headers)
    assert verify_resp.status_code == 404


@pytest.mark.asyncio
async def test_upload_invalid_extension(client: AsyncClient, auth_headers: dict):
    files = {"file": ("malicious.exe", b"binary content", "application/octet-stream")}
    resp = await client.post("/api/v1/documents/upload", files=files, headers=auth_headers)
    assert resp.status_code == 400
    assert "Unsupported file type" in resp.json()["detail"]

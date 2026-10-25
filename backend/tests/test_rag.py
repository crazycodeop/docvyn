import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.services.embedding_service import EmbeddingService


@pytest.mark.asyncio
async def test_rag_query_with_citations(client: AsyncClient, db_session: AsyncSession, test_user: User, auth_headers: dict):
    # Setup document and chunk for test_user
    doc = Document(
        id="doc-rag-test",
        user_id=test_user.id,
        title="Enterprise Architecture Guide",
        filename="arch_guide.pdf",
        file_path="users/test/arch_guide.pdf",
        file_size=2048,
        mime_type="application/pdf",
        file_hash="hash_rag_1",
        status="completed",
        page_count=3,
        chunk_count=1,
        metadata_json={},
    )
    db_session.add(doc)
    await db_session.commit()

    emb_svc = EmbeddingService()
    test_text = "DocRAG uses Supabase PostgreSQL with pgvector for high-performance vector search."
    emb = emb_svc.get_embedding(test_text)

    chunk = DocumentChunk(
        document_id=doc.id,
        chunk_index=0,
        content=test_text,
        page_number=2,
        token_count=15,
        embedding=emb,
        metadata_json={},
    )
    db_session.add(chunk)
    await db_session.commit()

    # Query RAG
    resp = await client.post(
        "/api/v1/chat/query",
        json={
            "question": "What database does DocRAG use for vector search?",
            "top_k": 3,
            "similarity_threshold": 0.1,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert len(data["citations"]) >= 1
    citation = data["citations"][0]
    assert citation["document_id"] == "doc-rag-test"
    assert citation["page_number"] == 2
    assert citation["document_title"] == "Enterprise Architecture Guide"

    # Verify conversation was persisted
    conv_id = data["conversation_id"]
    conv_resp = await client.get(f"/api/v1/chat/conversations/{conv_id}", headers=auth_headers)
    assert conv_resp.status_code == 200
    conv_data = conv_resp.json()
    assert len(conv_data["messages"]) == 2  # user + assistant
    assert conv_data["messages"][0]["role"] == "user"
    assert conv_data["messages"][1]["role"] == "assistant"

    # Verify PDF export endpoint
    pdf_resp = await client.get(f"/api/v1/chat/conversations/{conv_id}/export-pdf", headers=auth_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert len(pdf_resp.content) > 500  # Valid PDF binary

    # Verify real dashboard stats
    stats_resp = await client.get("/api/v1/stats/dashboard", headers=auth_headers)
    assert stats_resp.status_code == 200
    stats_data = stats_resp.json()
    assert stats_data["total_documents"] >= 1
    assert stats_data["total_chunks"] >= 1
    assert stats_data["total_conversations"] >= 1
    assert stats_data["total_messages"] >= 2
    assert "daily_ingestion_history" in stats_data
    assert len(stats_data["daily_ingestion_history"]) == 14


@pytest.mark.asyncio
async def test_greeting_conversational_response(client: AsyncClient, auth_headers: dict):
    """Verifies that greetings like 'hi', 'hello', 'hiiii' receive warm responses without 'No content found'."""
    for greeting in ["hi", "hiiii", "Hello!", "Hey there"]:
        resp = await client.post(
            "/api/v1/chat/query",
            json={"question": greeting},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "answer" in data
        assert "not contain sufficient information" not in data["answer"].lower()
        assert len(data["citations"]) == 0

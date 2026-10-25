import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.models.conversation import Conversation
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_user_data_isolation(client: AsyncClient, db_session: AsyncSession):
    # Create User A and User B
    user_a = User(
        id="user-a-uuid",
        email="user_a@example.com",
        full_name="User Alpha",
        hashed_password=get_password_hash("password123"),
        role="user",
        is_active=True,
    )
    user_b = User(
        id="user-b-uuid",
        email="user_b@example.com",
        full_name="User Beta",
        hashed_password=get_password_hash("password123"),
        role="user",
        is_active=True,
    )
    db_session.add_all([user_a, user_b])
    await db_session.commit()

    # Create document for User B
    doc_b = Document(
        id="doc-b-secret",
        user_id=user_b.id,
        title="Beta Secret Roadmap",
        filename="roadmap.pdf",
        file_path="users/user_b/roadmap.pdf",
        file_size=1024,
        mime_type="application/pdf",
        file_hash="hash_b_123",
        status="completed",
        page_count=1,
        chunk_count=1,
        metadata_json={},
    )
    db_session.add(doc_b)
    await db_session.commit()

    # User A tries to access User B's document
    token_a = create_access_token(user_a.id)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    resp = await client.get(f"/api/v1/documents/{doc_b.id}", headers=headers_a)
    assert resp.status_code == 404

    # User A tries to list documents, User B's document must not appear
    list_resp = await client.get("/api/v1/documents", headers=headers_a)
    assert list_resp.status_code == 200
    docs_a = list_resp.json()["items"]
    assert len(docs_a) == 0

    # User A queries RAG with content from User B's secret document
    # Add a chunk to doc_b
    chunk_b = DocumentChunk(
        document_id=doc_b.id,
        chunk_index=0,
        content="Confidential Project Apollo launch date is November 30.",
        page_number=1,
        token_count=10,
        embedding=[0.1] * 384,
        metadata_json={},
    )
    db_session.add(chunk_b)
    await db_session.commit()

    rag_resp = await client.post(
        "/api/v1/chat/query",
        json={"question": "When is Project Apollo launching?"},
        headers=headers_a,
    )
    assert rag_resp.status_code == 200
    rag_data = rag_resp.json()
    # Must NOT have citations from User B's document!
    assert len(rag_data["citations"]) == 0
    assert "sufficient information" in rag_data["answer"].lower()

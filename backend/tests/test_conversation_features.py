import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.core.security import get_password_hash, create_access_token


@pytest.mark.asyncio
async def test_pin_and_archive_conversations(client: AsyncClient, db_session: AsyncSession):
    user = User(
        id="user-features-test",
        email="features@example.com",
        full_name="Features Tester",
        hashed_password=get_password_hash("password123"),
        role="user",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create two conversations
    conv1 = Conversation(id="conv-1", user_id=user.id, title="Quarterly Financials")
    conv2 = Conversation(id="conv-2", user_id=user.id, title="Product Roadmap")
    db_session.add_all([conv1, conv2])
    await db_session.commit()

    # 2. Pin conv2
    patch_res = await client.patch("/api/v1/chat/conversations/conv-2", json={"is_pinned": True}, headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["is_pinned"] is True

    # 3. List active conversations -> conv2 must appear first (pinned)
    list_res = await client.get("/api/v1/chat/conversations", headers=headers)
    assert list_res.status_code == 200
    convs = list_res.json()
    assert len(convs) == 2
    assert convs[0]["id"] == "conv-2"
    assert convs[0]["is_pinned"] is True

    # 4. Archive conv1
    arch_res = await client.patch("/api/v1/chat/conversations/conv-1", json={"is_archived": True}, headers=headers)
    assert arch_res.status_code == 200
    assert arch_res.json()["is_archived"] is True

    # 5. List active conversations -> only conv2 remains
    active_res = await client.get("/api/v1/chat/conversations", headers=headers)
    assert active_res.status_code == 200
    active_convs = active_res.json()
    assert len(active_convs) == 1
    assert active_convs[0]["id"] == "conv-2"

    # 6. List archived conversations -> conv1 is present
    archived_list_res = await client.get("/api/v1/chat/conversations?archived=true", headers=headers)
    assert archived_list_res.status_code == 200
    archived_convs = archived_list_res.json()
    assert len(archived_convs) == 1
    assert archived_convs[0]["id"] == "conv-1"

    # 7. Restore conv1
    restore_res = await client.patch("/api/v1/chat/conversations/conv-1", json={"is_archived": False}, headers=headers)
    assert restore_res.status_code == 200
    assert restore_res.json()["is_archived"] is False

    # 8. Unpin conv2
    unpin_res = await client.patch("/api/v1/chat/conversations/conv-2", json={"is_pinned": False}, headers=headers)
    assert unpin_res.status_code == 200
    assert unpin_res.json()["is_pinned"] is False


@pytest.mark.asyncio
async def test_search_conversations(client: AsyncClient, db_session: AsyncSession):
    user = User(
        id="user-search-test",
        email="searcher@example.com",
        full_name="Search Tester",
        hashed_password=get_password_hash("password123"),
        role="user",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    conv = Conversation(id="conv-search-1", user_id=user.id, title="Legal Contract Review")
    msg1 = Message(
        id="msg-search-1",
        conversation_id="conv-search-1",
        role="user",
        content="What is the indemnification clause in Section 4?",
        citations_json=[],
    )
    msg2 = Message(
        id="msg-search-2",
        conversation_id="conv-search-1",
        role="assistant",
        content="The liability cap is strictly limited to fifty thousand dollars.",
        citations_json=[],
    )
    db_session.add_all([conv, msg1, msg2])
    await db_session.commit()

    # Search by title match
    res_title = await client.get("/api/v1/chat/conversations/search?q=Legal", headers=headers)
    assert res_title.status_code == 200
    results = res_title.json()
    assert len(results) == 1
    assert results[0]["id"] == "conv-search-1"

    # Search by message content match
    res_msg = await client.get("/api/v1/chat/conversations/search?q=indemnification", headers=headers)
    assert res_msg.status_code == 200
    results_msg = res_msg.json()
    assert len(results_msg) == 1
    assert "indemnification" in results_msg[0]["snippet"].lower()

    # Empty search query returns empty list
    res_empty = await client.get("/api/v1/chat/conversations/search?q=   ", headers=headers)
    assert res_empty.status_code == 200
    assert res_empty.json() == []


@pytest.mark.asyncio
async def test_secure_conversation_sharing(client: AsyncClient, db_session: AsyncSession):
    user = User(
        id="user-share-owner",
        email="owner@example.com",
        full_name="Share Owner",
        hashed_password=get_password_hash("password123"),
        role="user",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    conv = Conversation(id="conv-share-1", user_id=user.id, title="Architecture Blueprint")
    msg1 = Message(id="msg-sh-1", conversation_id="conv-share-1", role="user", content="Explain the database design", citations_json=[])
    msg2 = Message(id="msg-sh-2", conversation_id="conv-share-1", role="assistant", content="We use PostgreSQL and vector storage.", citations_json=[{"document_id": "doc-1", "document_title": "Arch.pdf", "snippet": "Postgres diagram"}])
    db_session.add_all([conv, msg1, msg2])
    await db_session.commit()

    # 1. Create share link
    share_res = await client.post(
        "/api/v1/chat/conversations/conv-share-1/share",
        json={"title": "Shared Architecture Blueprint"},
        headers=headers,
    )
    assert share_res.status_code == 200
    share_data = share_res.json()
    share_token = share_data["share_token"]
    assert share_token
    assert share_data["is_revoked"] is False

    # 2. Access shared conversation anonymously (no auth headers required)
    public_res = await client.get(f"/api/v1/shared/{share_token}")
    assert public_res.status_code == 200
    public_data = public_res.json()
    assert public_data["title"] == "Shared Architecture Blueprint"
    assert len(public_data["messages"]) == 2
    # Verify no private document ID is exposed to visitors
    assert public_data["messages"][1]["citations"][0]["document_id"] == "ref"

    # 3. Revoke share link
    revoke_res = await client.delete("/api/v1/chat/conversations/conv-share-1/share", headers=headers)
    assert revoke_res.status_code == 200

    # 4. Accessing revoked share link returns 404
    revoked_access_res = await client.get(f"/api/v1/shared/{share_token}")
    assert revoked_access_res.status_code == 404


@pytest.mark.asyncio
async def test_download_original_file(client: AsyncClient, db_session: AsyncSession):
    from app.models.document import Document
    from app.storage.local import LocalStorageProvider

    user_owner = User(
        id="user-doc-owner",
        email="docowner@example.com",
        full_name="Doc Owner",
        hashed_password=get_password_hash("password123"),
        role="user",
        is_active=True,
    )
    user_other = User(
        id="user-doc-other",
        email="docother@example.com",
        full_name="Doc Other",
        hashed_password=get_password_hash("password123"),
        role="user",
        is_active=True,
    )
    db_session.add_all([user_owner, user_other])
    await db_session.commit()

    # Create dummy physical file
    storage = LocalStorageProvider()
    file_bytes = b"Sample confidential original file content in PDF format"
    stored_path = storage.save(file_bytes, "users/user-doc-owner/docs/sample_doc.pdf")

    doc = Document(
        id="doc-download-1",
        user_id=user_owner.id,
        title="Annual Report",
        filename="Annual_Report_2026.pdf",
        file_path=stored_path,
        file_size=len(file_bytes),
        mime_type="application/pdf",
        file_hash="dummy_hash_123",
        status="completed",
        page_count=1,
        chunk_count=1,
        metadata_json={},
    )
    db_session.add(doc)
    await db_session.commit()

    owner_token = create_access_token(user_owner.id)
    other_token = create_access_token(user_other.id)

    # 1. Owner downloads -> 200 with attachment header
    owner_res = await client.get(
        "/api/v1/documents/doc-download-1/download",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert owner_res.status_code == 200
    assert owner_res.content == file_bytes
    assert 'attachment; filename="Annual_Report_2026.pdf"' in owner_res.headers.get("Content-Disposition", "")
    assert owner_res.headers.get("Content-Type") == "application/pdf"

    # 2. Unauthorized user downloads -> 404 (document not found for user_other)
    unauth_res = await client.get(
        "/api/v1/documents/doc-download-1/download",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert unauth_res.status_code == 404


@pytest.mark.asyncio
async def test_edit_user_message_and_regenerate_response(client: AsyncClient, db_session: AsyncSession, monkeypatch):
    """Verifies editing a user message truncates subsequent turns and generates new response, updating PDF export."""
    from app.services.rag_service import RAGService
    from app.schemas.chat import Citation
    import datetime

    user = User(
        id="user-edit-msg-test",
        email="editmsg@example.com",
        full_name="Edit Tester",
        hashed_password=get_password_hash("password123"),
        role="user",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    token = create_access_token(user.id)
    headers = {"Authorization": f"Bearer {token}"}

    conv = Conversation(id="conv-edit-test", user_id=user.id, title="Original Conversation")
    db_session.add(conv)
    await db_session.commit()

    now = datetime.datetime.now(datetime.timezone.utc)
    m1 = Message(
        id="msg-u1",
        conversation_id="conv-edit-test",
        role="user",
        content="What is Javascript hoisting?",
        created_at=now - datetime.timedelta(seconds=60),
    )
    m2 = Message(
        id="msg-a1",
        conversation_id="conv-edit-test",
        role="assistant",
        content="Hoisting is a JavaScript mechanism where variable declarations are moved to the top of their scope.",
        created_at=now - datetime.timedelta(seconds=50),
    )
    m3 = Message(
        id="msg-u2",
        conversation_id="conv-edit-test",
        role="user",
        content="Tell me about let vs var.",
        created_at=now - datetime.timedelta(seconds=30),
    )
    m4 = Message(
        id="msg-a2",
        conversation_id="conv-edit-test",
        role="assistant",
        content="let is block scoped, var is function scoped.",
        created_at=now - datetime.timedelta(seconds=20),
    )
    db_session.add_all([m1, m2, m3, m4])
    await db_session.commit()

    # Mock rag_service.answer_query so we don't call external Groq LLM in unit test
    async def mock_answer_query(*args, **kwargs):
        return "Updated explanation: Functions and variables can be referenced before declaration.", [
            Citation(document_id="doc-1", document_title="JS Guide", page_number=1, snippet="Hoisting snippet")
        ]

    from app.api.v1.endpoints import chat as chat_endpoint
    monkeypatch.setattr(chat_endpoint.rag_service, "answer_query", mock_answer_query)

    # 1. Edit the FIRST user message (m1)
    edit_res = await client.post(
        "/api/v1/chat/conversations/conv-edit-test/messages/msg-u1/edit",
        json={"content": "Explain JavaScript hoisting clearly and in depth."},
        headers=headers,
    )
    assert edit_res.status_code == 200
    data = edit_res.json()
    assert "Updated explanation" in data["answer"]
    assert data["user_message_id"] == "msg-u1"

    # 2. Get conversation history -> subsequent messages m2, m3, m4 should be pruned,
    # leaving only updated m1 + new assistant message!
    conv_res = await client.get("/api/v1/chat/conversations/conv-edit-test", headers=headers)
    assert conv_res.status_code == 200
    msgs = conv_res.json()["messages"]
    assert len(msgs) == 2
    assert msgs[0]["id"] == "msg-u1"
    assert msgs[0]["content"] == "Explain JavaScript hoisting clearly and in depth."
    assert msgs[1]["role"] == "assistant"
    assert "Updated explanation" in msgs[1]["content"]

    # 3. Export PDF -> Should succeed with 200 and return PDF bytes containing the updated conversation
    pdf_res = await client.get("/api/v1/chat/conversations/conv-edit-test/export-pdf", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["Content-Type"] == "application/pdf"
    assert len(pdf_res.content) > 1000

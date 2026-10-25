import os
import pytest
from app.storage.local import LocalStorageProvider


def test_local_storage_lifecycle(tmp_path):
    storage = LocalStorageProvider(base_dir=str(tmp_path))
    content = b"Hello, DocRAG Storage System!"
    rel_path = "docs/test_doc.pdf"

    # Save
    stored_path = storage.save(content, rel_path)
    assert storage.exists(stored_path)

    # Load
    loaded_bytes = storage.load(stored_path)
    assert loaded_bytes == content

    # Delete
    deleted = storage.delete(stored_path)
    assert deleted is True
    assert not storage.exists(stored_path)


def test_storage_path_traversal_prevention(tmp_path):
    storage = LocalStorageProvider(base_dir=str(tmp_path))
    malicious_path = "../../../etc/passwd"
    with pytest.raises(ValueError, match="Path traversal detected"):
        storage.save(b"malicious", malicious_path)

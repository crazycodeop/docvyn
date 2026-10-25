import os
import shutil
from app.core.config import settings
from app.core.logging import logger
from app.storage.base import StorageProvider


class LocalStorageProvider(StorageProvider):
    def __init__(self, base_dir: str = settings.LOCAL_STORAGE_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def _resolve_safe_path(self, relative_path: str) -> str:
        # Prevent path traversal attacks
        clean_rel = os.path.normpath(relative_path).lstrip("/\\")
        full_path = os.path.abspath(os.path.join(self.base_dir, clean_rel))
        if not full_path.startswith(self.base_dir):
            raise ValueError(f"Path traversal detected: {relative_path}")
        return full_path

    def save(self, content: bytes, destination_path: str) -> str:
        full_path = self._resolve_safe_path(destination_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(content)
        # Return relative path for portability
        return os.path.relpath(full_path, self.base_dir)

    def load(self, file_path: str) -> bytes:
        full_path = self._resolve_safe_path(file_path)
        if not os.path.isfile(full_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        with open(full_path, "rb") as f:
            return f.read()

    def delete(self, file_path: str) -> bool:
        try:
            full_path = self._resolve_safe_path(file_path)
            if os.path.isfile(full_path):
                os.remove(full_path)
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete file {file_path}: {e}")
            return False

    def exists(self, file_path: str) -> bool:
        try:
            full_path = self._resolve_safe_path(file_path)
            return os.path.isfile(full_path)
        except Exception:
            return False

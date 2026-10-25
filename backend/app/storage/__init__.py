from app.core.config import settings
from app.storage.base import StorageProvider
from app.storage.local import LocalStorageProvider
from app.storage.s3 import S3StorageProvider


def get_storage() -> StorageProvider:
    if settings.STORAGE_TYPE.lower() == "s3":
        return S3StorageProvider()
    return LocalStorageProvider()


__all__ = ["StorageProvider", "LocalStorageProvider", "S3StorageProvider", "get_storage"]

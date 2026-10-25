import io
from typing import Optional
from app.core.config import settings
from app.core.logging import logger
from app.storage.base import StorageProvider

try:
    import boto3
    from botocore.exceptions import ClientError
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False


class S3StorageProvider(StorageProvider):
    def __init__(self):
        if not HAS_BOTO3:
            raise RuntimeError("boto3 package is not installed for S3 storage.")
        
        session = boto3.session.Session()
        self.client = session.client(
            service_name="s3",
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            endpoint_url=settings.S3_ENDPOINT_URL,
            region_name=settings.S3_REGION,
        )
        self.bucket = settings.S3_BUCKET
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception:
            try:
                self.client.create_bucket(Bucket=self.bucket)
            except Exception as e:
                logger.warning(f"Could not auto-create S3 bucket {self.bucket}: {e}")

    def save(self, content: bytes, destination_path: str) -> str:
        clean_key = destination_path.lstrip("/\\")
        self.client.put_object(
            Bucket=self.bucket,
            Key=clean_key,
            Body=content,
        )
        return clean_key

    def load(self, file_path: str) -> bytes:
        clean_key = file_path.lstrip("/\\")
        response = self.client.get_object(Bucket=self.bucket, Key=clean_key)
        return response["Body"].read()

    def delete(self, file_path: str) -> bool:
        try:
            clean_key = file_path.lstrip("/\\")
            self.client.delete_object(Bucket=self.bucket, Key=clean_key)
            return True
        except Exception as e:
            logger.error(f"Failed to delete S3 object {file_path}: {e}")
            return False

    def exists(self, file_path: str) -> bool:
        try:
            clean_key = file_path.lstrip("/\\")
            self.client.head_object(Bucket=self.bucket, Key=clean_key)
            return True
        except Exception:
            return False

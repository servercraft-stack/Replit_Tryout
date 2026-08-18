"""S3/MinIO-backed source storage for project files."""

from __future__ import annotations

import asyncio
import logging
from functools import cached_property
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)


class WorkspaceObjectStorage:
    """The only persistence boundary for FileNode source content."""

    @cached_property
    def client(self):
        try:
            import boto3
            from botocore.config import Config
        except ImportError as exc:  # keeps Django management commands usable before install
            raise RuntimeError("boto3 is required for workspace object storage") from exc
        return boto3.client(
            "s3",
            endpoint_url=settings.WORKSPACE_S3_ENDPOINT_URL,
            aws_access_key_id=settings.WORKSPACE_S3_ACCESS_KEY,
            aws_secret_access_key=settings.WORKSPACE_S3_SECRET_KEY,
            region_name=settings.WORKSPACE_S3_REGION,
            # Fail fast so the local development fallback does not leave the
            # editor waiting through boto's default retry cycle.
            config=Config(connect_timeout=1, read_timeout=2, retries={"max_attempts": 1}),
        )

    def read_text(self, key: str) -> str:
        if not key:
            return ""
        try:
            response = self.client.get_object(Bucket=settings.WORKSPACE_S3_BUCKET, Key=key)
        except Exception as exc:
            error = getattr(exc, "response", {}).get("Error", {}).get("Code")
            if error in {"NoSuchKey", "404"}:
                return ""
            if self._fallback_enabled:
                logger.warning("Workspace object storage unavailable; reading local fallback: %s", exc)
                return self._local_path(key).read_text(encoding="utf-8") if self._local_path(key).exists() else ""
            raise
        return response["Body"].read().decode("utf-8")

    def write_text(self, key: str, content: str) -> None:
        try:
            self.client.put_object(
                Bucket=settings.WORKSPACE_S3_BUCKET,
                Key=key,
                Body=content.encode("utf-8"),
                ContentType="text/plain; charset=utf-8",
            )
        except Exception as exc:
            if not self._fallback_enabled:
                raise
            logger.warning("Workspace object storage unavailable; writing local fallback: %s", exc)
            path = self._local_path(key)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")

    def delete(self, key: str) -> None:
        if key:
            try:
                self.client.delete_object(Bucket=settings.WORKSPACE_S3_BUCKET, Key=key)
            except Exception:
                if not self._fallback_enabled:
                    raise
                self._local_path(key).unlink(missing_ok=True)

    @property
    def _fallback_enabled(self) -> bool:
        return settings.WORKSPACE_STORAGE_FALLBACK_ENABLED

    def _local_path(self, key: str) -> Path:
        root = Path(settings.WORKSPACE_LOCAL_STORAGE_ROOT).resolve()
        path = (root / key).resolve()
        if root != path and root not in path.parents:
            raise ValueError("Invalid workspace storage key")
        return path

    async def aread_text(self, key: str) -> str:
        return await asyncio.to_thread(self.read_text, key)

    async def awrite_text(self, key: str, content: str) -> None:
        await asyncio.to_thread(self.write_text, key, content)


workspace_object_storage = WorkspaceObjectStorage()

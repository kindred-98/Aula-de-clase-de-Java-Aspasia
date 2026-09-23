"""Interfaz abstracta de almacenamiento de archivos."""

from __future__ import annotations

import hashlib
import secrets
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings

ALLOWED_EXTENSIONS = frozenset(
    {".java", ".zip", ".pdf", ".txt", ".md", ".png", ".jpg", ".jpeg", ".html", ".css", ".js", ".json"}
)

# Firmas binarias mínimas para validar tipo real (no solo extensión)
_MAGIC: tuple[tuple[bytes, str], ...] = (
    (b"%PDF", ".pdf"),
    (b"PK\x03\x04", ".zip"),
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"\xff\xd8\xff", ".jpg"),
)


class StorageError(Exception):
    def __init__(self, detail: str, status_code: int = 400) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def validate_filename(name: str) -> str:
    """Devuelve un nombre saneado; rechaza path traversal."""
    base = Path(name.replace("\\", "/")).name
    base = "".join(c for c in base if c.isprintable() and c not in '/\\<>:"|?*').strip()
    if not base or base in {".", ".."}:
        raise StorageError("Invalid filename")
    ext = Path(base).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise StorageError(f"Extension not allowed: {ext or '(none)'}")
    return base[:255]


def validate_content(filename: str, data: bytes) -> None:
    ext = Path(filename).suffix.lower()
    if len(data) > settings.max_upload_bytes:
        raise StorageError("File too large", status_code=413)
    if not data:
        raise StorageError("Empty file")
    for magic, magic_ext in _MAGIC:
        if data.startswith(magic) and ext == magic_ext:
            return
    # Texto / código: debe ser UTF-8 razonable sin binario peligroso
    if ext in {".txt", ".md", ".java", ".html", ".css", ".js", ".json"}:
        try:
            data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise StorageError("File content is not valid text") from exc
        if b"\x00" in data:
            raise StorageError("Binary content not allowed for text extensions")
        return
    # zip/png/jpg sin magic conocido u otros: rechazar si hay NULs y no matchea
    raise StorageError("File content does not match its extension")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Storage(ABC):
    @abstractmethod
    def save(self, data: bytes, *, original_name: str) -> tuple[str, str, int, str]:
        """Devuelve (stored_name, mime, size, sha256)."""

    @abstractmethod
    def open(self, stored_name: str) -> BinaryIO: ...

    @abstractmethod
    def delete(self, stored_name: str) -> None: ...


class LocalStorage(Storage):
    def __init__(self, root: str | Path | None = None) -> None:
        self.root = Path(root or settings.storage_local_path)
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _mime_for(name: str) -> str:
        ext = Path(name).suffix.lower()
        return {
            ".pdf": "application/pdf",
            ".zip": "application/zip",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".txt": "text/plain",
            ".md": "text/markdown",
            ".java": "text/x-java-source",
            ".html": "text/html",
            ".css": "text/css",
            ".js": "text/javascript",
            ".json": "application/json",
        }.get(ext, "application/octet-stream")

    def save(self, data: bytes, *, original_name: str) -> tuple[str, str, int, str]:
        stored = secrets.token_hex(16) + Path(original_name).suffix.lower()
        path = self.root / stored
        path.write_bytes(data)
        return stored, self._mime_for(original_name), len(data), sha256_hex(data)

    def open(self, stored_name: str) -> BinaryIO:
        path = self.root / Path(stored_name).name
        if not path.is_file():
            raise StorageError("File not found", status_code=404)
        return path.open("rb")

    def delete(self, stored_name: str) -> None:
        path = self.root / Path(stored_name).name
        try:
            path.unlink(missing_ok=True)
        except OSError:
            # Windows: archivo aún bloqueado por un stream; el intento es best-effort
            pass


class S3Storage(Storage):
    """Preparada para S3 compatible; requiere extra `s3` (boto3)."""

    def __init__(self) -> None:
        raise StorageError("S3 storage not configured yet", 501)  # pragma: no cover

    def save(self, data: bytes, *, original_name: str) -> tuple[str, str, int, str]:  # pragma: no cover
        raise NotImplementedError

    def open(self, stored_name: str) -> BinaryIO:  # pragma: no cover
        raise NotImplementedError

    def delete(self, stored_name: str) -> None:  # pragma: no cover
        raise NotImplementedError


def get_storage() -> Storage:
    if settings.storage_backend == "local":
        return LocalStorage()
    if settings.storage_backend == "s3":
        return S3Storage()  # pragma: no cover
    raise StorageError(f"Unknown storage backend: {settings.storage_backend}", 500)

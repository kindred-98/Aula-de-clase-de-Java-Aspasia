"""Tests de almacenamiento y validación de archivos."""

import pytest

from app.storage import (
    LocalStorage,
    StorageError,
    validate_content,
    validate_filename,
)


def test_validate_filename_allows_java() -> None:
    assert validate_filename("Main.java") == "Main.java"


def test_validate_filename_rejects_exe() -> None:
    with pytest.raises(StorageError, match="Extension not allowed"):
        validate_filename("virus.exe")


def test_validate_filename_strips_path() -> None:
    assert validate_filename("../../etc/passwd.txt") == "passwd.txt"


def test_validate_content_rejects_fake_png() -> None:
    with pytest.raises(StorageError):
        validate_content("x.png", b"definitely not png")


def test_validate_content_accepts_utf8_java() -> None:
    validate_content("Main.java", b"class Main {}")


def test_validate_content_rejects_empty() -> None:
    with pytest.raises(StorageError):
        validate_content("a.txt", b"")


def test_local_storage_roundtrip(tmp_path) -> None:
    storage = LocalStorage(tmp_path)
    data = b"public class A {}"
    stored, _mime, size, digest = storage.save(data, original_name="A.java")
    assert size == len(data)
    assert len(digest) == 64
    with storage.open(stored) as fh:
        assert fh.read() == data
    storage.delete(stored)
    with pytest.raises(StorageError):
        storage.open(stored)


def test_validate_content_accepts_real_pdf_magic() -> None:
    validate_content("doc.pdf", b"%PDF-1.7\n...")

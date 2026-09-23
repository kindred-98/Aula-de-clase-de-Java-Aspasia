"""Tests de hashing y JWT."""

from app.core.security import (
    create_access_token,
    create_refresh_token_value,
    decode_token,
    hash_secret,
    verify_secret,
)


def test_hash_and_verify_pin() -> None:
    hashed = hash_secret("123456")
    assert hashed != "123456"
    assert verify_secret("123456", hashed)
    assert not verify_secret("654321", hashed)


def test_verify_with_empty_hash_is_false() -> None:
    assert not verify_secret("123456", None)
    assert not verify_secret("123456", "")


def test_access_token_roundtrip() -> None:
    token = create_access_token(subject="1", role="student")
    payload = decode_token(token)
    assert payload["sub"] == "1"
    assert payload["role"] == "student"
    assert payload["type"] == "access"


def test_refresh_value_is_long_and_unique() -> None:
    a = create_refresh_token_value()
    b = create_refresh_token_value()
    assert a != b
    assert len(a) >= 64

"""Fixtures compartidas de pytest."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base


@pytest.fixture()
def db_session() -> Session:
    engine = create_engine("sqlite://", future=True)
    Base.metadata.create_all(engine)
    session = Session(engine, expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()

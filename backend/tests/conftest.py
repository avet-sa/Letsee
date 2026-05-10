from __future__ import annotations

import io
import sys
import types
from datetime import UTC, datetime

import boto3
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@compiles(PG_UUID, "sqlite")
def _compile_uuid_sqlite(_type, _compiler, **_kw):
    return "CHAR(36)"


class FakeS3Client:
    def __init__(self):
        self.objects: dict[str, dict] = {}

    def head_bucket(self, Bucket):
        return {"Bucket": Bucket}

    def create_bucket(self, Bucket):
        return {"Bucket": Bucket}

    def put_object(self, Bucket, Key, Body, ContentType=None, Metadata=None):
        self.objects[Key] = {
            "Bucket": Bucket,
            "Body": Body if isinstance(Body, bytes) else bytes(Body),
            "ContentType": ContentType,
            "Metadata": Metadata or {},
            "LastModified": datetime.now(UTC),
        }
        return {"ETag": "fake"}

    def get_object(self, Bucket, Key):
        obj = self.objects[Key]
        return {"Body": io.BytesIO(obj["Body"])}

    def list_objects_v2(self, Bucket, MaxKeys=None):
        contents = [
            {
                "Key": key,
                "Size": len(value["Body"]),
                "LastModified": value["LastModified"],
            }
            for key, value in self.objects.items()
            if value["Bucket"] == Bucket
        ]
        if MaxKeys is not None:
            contents = contents[:MaxKeys]
        return {"Contents": contents} if contents else {}

    def delete_object(self, Bucket, Key):
        self.objects.pop(Key, None)
        return {"Deleted": Key}


@pytest.fixture
def app(monkeypatch):
    fake_s3_client = FakeS3Client()
    monkeypatch.setattr(boto3, "client", lambda *args, **kwargs: fake_s3_client)

    fake_magic_module = types.SimpleNamespace(
        Magic=lambda mime=True: types.SimpleNamespace(from_buffer=lambda _content: "application/pdf")
    )
    monkeypatch.setitem(sys.modules, "magic", fake_magic_module)
    monkeypatch.setitem(sys.modules, "python_magic_bin", fake_magic_module)

    async def _allow(*args, **kwargs):
        return None

    async def _noop_async(*args, **kwargs):
        return None

    from app.core import rate_limit

    monkeypatch.setattr(rate_limit.api_rate_limiter, "start_cleanup", lambda: None)
    monkeypatch.setattr(rate_limit.api_rate_limiter, "check_rate_limit", _allow)
    monkeypatch.setattr(rate_limit.auth_rate_limiter, "check_rate_limit", _allow)
    monkeypatch.setattr(rate_limit.upload_rate_limiter, "check_rate_limit", _allow)

    from app.main import app as fastapi_app, backup_scheduler
    from app.core.database import Base, get_db

    monkeypatch.setattr(backup_scheduler, "start", _noop_async)
    monkeypatch.setattr(backup_scheduler, "stop", _noop_async)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    fastapi_app.state.testing_session_factory = TestingSessionLocal

    yield fastapi_app

    fastapi_app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session(app):
    session = app.state.testing_session_factory()
    try:
        yield session
    finally:
        session.close()

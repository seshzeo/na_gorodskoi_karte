from collections.abc import AsyncGenerator

import httpx
import pytest
from fastapi import FastAPI
from httpx import ASGITransport

from app.backend.core.database import get_db
from app.backend.core.security import require_moderator
from app.backend.main import app


class DummySession:
    async def execute(self, *args, **kwargs):
        raise AssertionError("Unexpected database access in isolated API test")

    async def scalar(self, *args, **kwargs):
        raise AssertionError("Unexpected database access in isolated API test")


@pytest.fixture
def test_app() -> FastAPI:
    app.dependency_overrides[get_db] = lambda: DummySession()
    app.dependency_overrides[require_moderator] = lambda: "moderator-test"
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client(test_app: FastAPI) -> AsyncGenerator[httpx.AsyncClient, None]:
    transport = ASGITransport(app=test_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

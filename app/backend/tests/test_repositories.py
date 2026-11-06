from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.backend.repositories import category, moderators, point_requests, points


class Result:
    def __init__(self, values=None, scalar_value=None, one_value=None):
        self._values = values or []
        self._scalar_value = scalar_value
        self._one_value = one_value
    def scalar_one_or_none(self): return self._scalar_value
    def scalars(self): return self
    def all(self): return self._values
    def one_or_none(self): return self._one_value


@pytest.mark.asyncio
async def test_category_repository_paths():
    db = MagicMock(); db.get = AsyncMock(return_value="cat")
    assert await category.get_category(db, 1) == "cat"
    db.execute = AsyncMock(return_value=Result(scalar_value="active"))
    assert await category.get_active_category(db, 1) == "active"
    db.execute = AsyncMock(return_value=Result(scalar_value="found"))
    assert await category.get_category_by_name_or_slug(db, name="Test", slug="test") == "found"
    db.execute = AsyncMock(return_value=Result(values=["a", "b"]))
    assert await category.list_active_categories(db) == ["a", "b"]
    db.scalar = AsyncMock(return_value=2); db.execute = AsyncMock(return_value=Result(values=["a"]))
    items, total = await category.list_all_categories(db, limit=10, offset=2)
    assert items == ["a"] and total == 2


@pytest.mark.asyncio
async def test_moderator_repository_paths():
    db = MagicMock(); db.execute = AsyncMock(return_value=Result(scalar_value="moderator"))
    assert await moderators.get_moderator_by_username(db, " Admin ") == "moderator"
    assert await moderators.get_moderator_session(db, "hash") == "moderator"


@pytest.mark.asyncio
async def test_request_repository_filters_and_lock():
    db = MagicMock(); db.scalar = AsyncMock(return_value=3); db.execute = AsyncMock(return_value=Result(values=["r1", "r2"]))
    rows, total = await point_requests.list_requests(db, status_value="pending", category_id=1, created_after=datetime(2026,1,1,tzinfo=timezone.utc), created_before=datetime(2026,2,1,tzinfo=timezone.utc), limit=10, offset=2)
    assert rows == ["r1", "r2"] and total == 3
    await point_requests.get_request(db, 1, lock=True)
    await point_requests.get_request(db, 2, lock=False)


@pytest.mark.asyncio
async def test_point_repository_filters_and_queries():
    db = MagicMock(); db.scalar = AsyncMock(return_value=4); db.execute = AsyncMock(return_value=Result(values=[("row",1.0,2.0)]))
    rows, total = await points.list_points(db, bbox=(45.0,51.0,47.0,52.0), category_ids=[1,2], event_after=datetime(2026,1,1,tzinfo=timezone.utc), event_before=datetime(2026,2,1,tzinfo=timezone.utc), limit=10, offset=0)
    assert rows and total == 4
    for status_value in ("active", "archived", "all"):
        rows, total = await points.list_moderator_points(db, status_value=status_value, category_id=1 if status_value == "active" else None, event_after=None, event_before=None, limit=10, offset=0)
        assert rows and total == 4
    db.execute = AsyncMock(return_value=Result(values=[("row",1.0,2.0,50.0)]))
    assert await points.nearby_points(db, latitude=51.5, longitude=46.0, radius=1000, limit=5)
    obj = SimpleNamespace(); db.add = MagicMock(); db.flush = AsyncMock()
    assert await points.save_point(db, obj) is obj
    db.add.assert_called_once_with(obj)
    assert "POINT(46.0 51.5)" in str(points.make_location(51.5, 46.0))

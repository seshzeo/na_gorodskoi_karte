from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.backend.core.database import get_db
from app.backend.main import _error_code


@pytest.mark.asyncio
async def test_root_and_health(client, test_app):
    response = await client.get("/")
    assert response.status_code == 200 and response.json()["docs"] == "/docs"
    class HealthSession:
        async def execute(self, query): return object()
    test_app.dependency_overrides[get_db] = lambda: HealthSession()
    response = await client.get("/api/v1/health")
    assert response.status_code == 200 and response.json()["status"] == "ok"


@pytest.mark.parametrize("code,expected", [(400,"bad_request"),(401,"unauthorized"),(403,"forbidden"),(404,"not_found"),(405,"method_not_allowed"),(409,"conflict"),(422,"validation_error"),(429,"too_many_requests"),(503,"service_unavailable"),(418,"http_error")])
def test_error_code_mapping(code, expected):
    assert _error_code(code) == expected


@pytest.mark.asyncio
async def test_categories_routes_and_errors(client, monkeypatch):
    from app.backend.routers import categories
    from app.backend.services.errors import ConflictError, NotFoundError
    cat={"id":1,"name":"Parks","slug":"parks","is_active":True,"is_builtin":False}
    monkeypatch.setattr(categories,"get_categories",AsyncMock(return_value=[cat]))
    assert (await client.get("/api/v1/categories")).status_code == 200
    monkeypatch.setattr(categories,"get_all_categories",AsyncMock(return_value={"items":[cat],"total":1,"limit":10,"offset":0}))
    assert (await client.get("/api/v1/moderator/categories?limit=10&offset=0")).status_code == 200
    monkeypatch.setattr(categories,"create_category",AsyncMock(return_value=cat))
    assert (await client.post("/api/v1/categories",json={"name":"Parks","slug":"parks"})).status_code == 201
    monkeypatch.setattr(categories,"update_category",AsyncMock(return_value=cat))
    assert (await client.patch("/api/v1/categories/1",json={"name":"New"})).status_code == 200
    monkeypatch.setattr(categories,"delete_category",AsyncMock())
    assert (await client.delete("/api/v1/categories/1")).status_code == 204
    monkeypatch.setattr(categories,"create_category",AsyncMock(side_effect=ConflictError("dup")))
    assert (await client.post("/api/v1/categories",json={"name":"Parks","slug":"parks"})).status_code == 409
    monkeypatch.setattr(categories,"update_category",AsyncMock(side_effect=NotFoundError("missing")))
    assert (await client.patch("/api/v1/categories/1",json={"name":"New"})).status_code == 404
    monkeypatch.setattr(categories,"update_category",AsyncMock(side_effect=ConflictError("dup")))
    assert (await client.patch("/api/v1/categories/1",json={"name":"New"})).status_code == 409
    monkeypatch.setattr(categories,"delete_category",AsyncMock(side_effect=NotFoundError("missing")))
    assert (await client.delete("/api/v1/categories/1")).status_code == 404
    monkeypatch.setattr(categories,"delete_category",AsyncMock(side_effect=ConflictError("used")))
    assert (await client.delete("/api/v1/categories/1")).status_code == 409


@pytest.mark.asyncio
async def test_auth_routes(client, test_app, monkeypatch):
    from app.backend.routers import auth
    moderator=SimpleNamespace(id="m1",username="admin")
    monkeypatch.setattr(auth,"issue_csrf_token",AsyncMock(return_value="csrf"))
    assert (await client.get("/api/v1/auth/csrf")).json()=={"csrf_token":"csrf"}
    monkeypatch.setattr(auth,"login",AsyncMock(return_value=(moderator,"newcsrf")))
    response=await client.post("/api/v1/auth/login",json={"username":"admin","password":"password"})
    assert response.status_code==200 and response.json()["username"]=="admin"
    class Result:
        def scalar_one(self): return moderator
    class Session:
        async def execute(self, query): return Result()
    test_app.dependency_overrides[get_db]=lambda: Session()
    assert (await client.get("/api/v1/auth/me")).status_code==200
    monkeypatch.setattr(auth,"get_session_from_request",AsyncMock(return_value=SimpleNamespace()))
    monkeypatch.setattr(auth,"logout",AsyncMock())
    monkeypatch.setattr(auth,"clear_session_cookie",lambda response:None)
    assert (await client.post("/api/v1/auth/logout")).status_code==204
    from fastapi import HTTPException
    monkeypatch.setattr(auth,"login",AsyncMock(side_effect=HTTPException(status_code=401,detail="bad")))
    assert (await client.post("/api/v1/auth/login",json={"username":"a","password":"b"})).status_code==401
    assert (await client.post("/api/v1/auth/login",json={"username":"a","password":"b","extra":1})).status_code==422


@pytest.mark.asyncio
async def test_points_routes_and_validation(client, monkeypatch):
    from app.backend.routers import points
    row=(SimpleNamespace(id=1,title="T",description="D",category_id=1,category=SimpleNamespace(name="P"),event_at=datetime.now(timezone.utc),point_type="event",author_name="A",created_at=datetime.now(timezone.utc),updated_at=datetime.now(timezone.utc),is_active=True),46.0,51.5)
    monkeypatch.setattr(points,"create_point",AsyncMock(return_value=row))
    created=await client.post("/api/v1/moderator/points",json={"title":"Park","description":"Permanent place","category_id":1,"latitude":51.5,"longitude":46.0,"point_type":"permanent"})
    assert created.status_code==201 and created.json()["point_type"]=="event"
    points.create_point.assert_awaited_once()
    assert points.create_point.await_args.args[1]["point_type"]=="permanent"
    monkeypatch.setattr(points,"fetch_points",AsyncMock(return_value={"rows":[row],"total":1}))
    response=await client.get("/api/v1/points?bbox=45,50,47,52&category_id=1&category_id=1")
    assert response.status_code==200 and response.json()["items"][0]["category_name"]=="P"
    monkeypatch.setattr(points,"fetch_nearby_points",AsyncMock(return_value=[row+(12.5,)]))
    assert (await client.get("/api/v1/points/nearby?latitude=51.5&longitude=46&radius=1000")).status_code==200
    monkeypatch.setattr(points,"fetch_point",AsyncMock(return_value=row))
    assert (await client.get("/api/v1/points/1")).status_code==200
    for url in ["/api/v1/points?bbox=bad","/api/v1/points?bbox=1,2,3","/api/v1/points?bbox=181,2,3,4","/api/v1/points?bbox=1,91,3,92","/api/v1/points?bbox=3,2,1,4","/api/v1/points?category_id=0","/api/v1/points?event_after=2026-01-01T00:00:00","/api/v1/points?event_after=2026-02-01T00:00:00Z&event_before=2026-01-01T00:00:00Z"]:
        assert (await client.get(url)).status_code==422


@pytest.mark.asyncio
async def test_point_mutations_and_moderator_routes(client, monkeypatch):
    from app.backend.routers import points
    from app.backend.services.errors import ConflictError, NotFoundError
    row=(SimpleNamespace(id=1,title="T",description="D",category_id=1,category=SimpleNamespace(name="P"),event_at=datetime.now(timezone.utc),point_type="event",author_name="A",created_at=datetime.now(timezone.utc),updated_at=datetime.now(timezone.utc),is_active=True),46.0,51.5)
    monkeypatch.setattr(points,"update_point",AsyncMock(return_value=row))
    assert (await client.patch("/api/v1/points/1",json={"title":"N"})).status_code==200
    monkeypatch.setattr(points,"update_point",AsyncMock(side_effect=NotFoundError("missing")))
    assert (await client.patch("/api/v1/points/1",json={"title":"N"})).status_code==404
    monkeypatch.setattr(points,"hide_point",AsyncMock())
    assert (await client.delete("/api/v1/points/1")).status_code==204
    monkeypatch.setattr(points,"hide_point",AsyncMock(side_effect=ConflictError("already")))
    assert (await client.delete("/api/v1/points/1")).status_code==409
    monkeypatch.setattr(points,"restore_point",AsyncMock(return_value=row))
    assert (await client.post("/api/v1/points/1/restore")).status_code==200
    monkeypatch.setattr(points,"restore_point",AsyncMock(side_effect=NotFoundError("missing")))
    assert (await client.post("/api/v1/points/1/restore")).status_code==404
    monkeypatch.setattr(points,"fetch_moderator_points",AsyncMock(return_value={"rows":[row],"total":1}))
    assert (await client.get("/api/v1/moderator/points?status=all")).status_code==200
    monkeypatch.setattr(points,"fetch_point",AsyncMock(return_value=row))
    assert (await client.get("/api/v1/moderator/points/1")).status_code==200
    monkeypatch.setattr(points,"update_point",AsyncMock(return_value=row))
    assert (await client.patch("/api/v1/moderator/points/1",json={"title":"N"})).status_code==200
    monkeypatch.setattr(points,"hide_point",AsyncMock())
    assert (await client.delete("/api/v1/moderator/points/1")).status_code==204
    monkeypatch.setattr(points,"restore_point",AsyncMock(return_value=row))
    assert (await client.post("/api/v1/moderator/points/1/restore")).status_code==200
    assert (await client.get("/api/v1/moderator/points?event_after=2026-01-01T00:00:00")).status_code==422

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_point_request_routes(client, monkeypatch):
    from app.backend.routers import point_requests
    item={"id":1,"author_name":"A","title":"T","description":"D","category_id":1,"latitude":1.0,"longitude":2.0,"event_at":"2026-01-01T00:00:00Z","status":"pending","rejection_reason":None,"moderated_at":None,"point_id":None,"created_at":"2026-01-01T00:00:00Z"}
    payload={"author_name":"A","title":"T","description":"D","category_id":1,"latitude":1,"longitude":2,"event_at":"2026-01-01T00:00:00Z"}
    monkeypatch.setattr(point_requests,"submit_request",AsyncMock(return_value=item))
    assert (await client.post("/api/v1/point-requests",json=payload)).status_code==201
    monkeypatch.setattr(point_requests,"fetch_requests",AsyncMock(return_value={"rows":[item],"total":1}))
    assert (await client.get("/api/v1/point-requests?status=pending&category_id=1&limit=10")).status_code==200
    assert (await client.get("/api/v1/point-requests?created_after=2026-01-02T00:00:00Z&created_before=2026-01-01T00:00:00Z")).status_code==422
    assert (await client.get("/api/v1/point-requests?created_after=2026-01-01T00:00:00")).status_code==422
    monkeypatch.setattr(point_requests,"fetch_request",AsyncMock(return_value=item))
    assert (await client.get("/api/v1/point-requests/1")).status_code==200
    monkeypatch.setattr(point_requests,"update_request",AsyncMock(return_value=item))
    assert (await client.patch("/api/v1/point-requests/1",json={"title":"N"})).status_code==200
    monkeypatch.setattr(point_requests,"approve_request",AsyncMock(return_value=item))
    assert (await client.post("/api/v1/point-requests/1/approve")).status_code==200
    monkeypatch.setattr(point_requests,"reject_request",AsyncMock(return_value=item))
    assert (await client.post("/api/v1/point-requests/1/reject",json={"reason":"bad"})).status_code==200


@pytest.mark.asyncio
async def test_point_request_error_handlers(client, monkeypatch):
    from app.backend.routers import point_requests
    from app.backend.services.errors import ConflictError, NotFoundError
    payload={"author_name":"A","title":"T","description":"D","category_id":1,"latitude":1,"longitude":2,"event_at":"2026-01-01T00:00:00Z"}
    monkeypatch.setattr(point_requests,"submit_request",AsyncMock(side_effect=NotFoundError("cat")))
    assert (await client.post("/api/v1/point-requests",json=payload)).status_code==404
    monkeypatch.setattr(point_requests,"fetch_request",AsyncMock(side_effect=NotFoundError("missing")))
    assert (await client.get("/api/v1/point-requests/1")).status_code==404
    monkeypatch.setattr(point_requests,"update_request",AsyncMock(side_effect=ConflictError("state")))
    assert (await client.patch("/api/v1/point-requests/1",json={"title":"x"})).status_code==409
    monkeypatch.setattr(point_requests,"approve_request",AsyncMock(side_effect=NotFoundError("missing")))
    assert (await client.post("/api/v1/point-requests/1/approve")).status_code==404
    monkeypatch.setattr(point_requests,"reject_request",AsyncMock(side_effect=ConflictError("state")))
    assert (await client.post("/api/v1/point-requests/1/reject",json={"reason":"bad"})).status_code==409


@pytest.mark.asyncio
async def test_audit_route(client, monkeypatch):
    from app.backend.routers import audit
    item=SimpleNamespace(id=1,moderator_id="m1",action="x",object_type="point",object_id="1",details=None,created_at=datetime.now(timezone.utc))
    monkeypatch.setattr(audit,"list_moderator_actions",AsyncMock(return_value=([item],1)))
    response=await client.get("/api/v1/moderator/audit-logs?action=x&object_type=point")
    assert response.status_code==200 and response.json()["total"]==1
    assert (await client.get("/api/v1/moderator/audit-logs?object_type=bad")).status_code==422

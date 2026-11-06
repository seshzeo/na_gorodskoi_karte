from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.backend.models.point import Point\nfrom app.backend.models.point_request import PointRequestStatus
from app.backend.services import auth, catalog, point_requests, points
from app.backend.services.errors import ConflictError, NotFoundError


@pytest.mark.asyncio
async def test_catalog_create_and_list(monkeypatch):
    db = MagicMock(); db.flush = AsyncMock(); db.commit = AsyncMock(); db.refresh = AsyncMock(); db.add = MagicMock(); db.scalar = AsyncMock(return_value=0)
    monkeypatch.setattr(catalog, "get_category_by_name_or_slug", AsyncMock(return_value=None))
    monkeypatch.setattr(catalog, "record_moderator_action", AsyncMock())
    cat = await catalog.create_category(db, {"name":"Parks","slug":"parks"}, "m1")
    assert cat.name == "Parks" and cat.slug == "parks"
    monkeypatch.setattr(catalog, "list_active_categories", AsyncMock(return_value=[cat]))
    monkeypatch.setattr(catalog, "list_all_categories", AsyncMock(return_value=([cat], 1)))
    assert await catalog.get_categories(db) == [cat]
    assert await catalog.get_all_categories(db, limit=10, offset=0) == {"items":[cat],"total":1,"limit":10,"offset":0}


@pytest.mark.asyncio
async def test_catalog_create_duplicate_and_integrity(monkeypatch):
    db = MagicMock(); db.flush = AsyncMock(); db.commit = AsyncMock(); db.rollback = AsyncMock(); db.add = MagicMock()
    monkeypatch.setattr(catalog, "get_category_by_name_or_slug", AsyncMock(return_value=SimpleNamespace(id=2)))
    with pytest.raises(ConflictError):
        await catalog.create_category(db, {"name":"Parks","slug":"parks"}, "m1")
    monkeypatch.setattr(catalog, "get_category_by_name_or_slug", AsyncMock(return_value=None))
    db.flush.side_effect = IntegrityError("stmt", {}, Exception("duplicate"))
    with pytest.raises(ConflictError):
        await catalog.create_category(db, {"name":"Parks","slug":"parks"}, "m1")
    db.rollback.assert_awaited()


@pytest.mark.asyncio
async def test_catalog_update_paths(monkeypatch):
    category_obj = SimpleNamespace(id=1, name="Old", slug="old", is_active=True)
    db = MagicMock(); db.scalar = AsyncMock(side_effect=[False, False]); db.commit = AsyncMock(); db.refresh = AsyncMock()
    monkeypatch.setattr(catalog, "get_category", AsyncMock(return_value=category_obj))
    monkeypatch.setattr(catalog, "get_category_by_name_or_slug", AsyncMock(return_value=None))
    monkeypatch.setattr(catalog, "record_moderator_action", AsyncMock())
    got = await catalog.update_category(db, 1, {"name":"New","slug":"new"}, "m1")
    assert got.name == "New" and got.slug == "new"
    monkeypatch.setattr(catalog, "get_category", AsyncMock(return_value=None))
    with pytest.raises(NotFoundError):
        await catalog.update_category(db, 1, {"name":"x"}, "m1")
    category_obj = SimpleNamespace(id=1, name="Old", slug="old", is_active=True)
    monkeypatch.setattr(catalog, "get_category", AsyncMock(return_value=category_obj))
    monkeypatch.setattr(catalog, "get_category_by_name_or_slug", AsyncMock(return_value=SimpleNamespace(id=2)))
    with pytest.raises(ConflictError):
        await catalog.update_category(db, 1, {"name":"Taken"}, "m1")


@pytest.mark.asyncio
async def test_catalog_update_deactivate_conflicts(monkeypatch):
    category_obj = SimpleNamespace(id=1, name="Old", slug="old", is_active=True)
    db = MagicMock(); db.scalar = AsyncMock(side_effect=[True, False]);
    monkeypatch.setattr(catalog, "get_category", AsyncMock(return_value=category_obj))
    monkeypatch.setattr(catalog, "get_category_by_name_or_slug", AsyncMock(return_value=None))
    with pytest.raises(ConflictError):
        await catalog.update_category(db, 1, {"is_active":False}, "m1")
    db.scalar = AsyncMock(side_effect=[False, True])
    with pytest.raises(ConflictError):
        await catalog.update_category(db, 1, {"is_active":False}, "m1")


@pytest.mark.asyncio
async def test_catalog_update_integrity(monkeypatch):
    category_obj = SimpleNamespace(id=1, name="Old", slug="old", is_active=True)
    db = MagicMock(); db.scalar = AsyncMock(side_effect=[False, False]); db.commit = AsyncMock(side_effect=IntegrityError("stmt", {}, Exception())); db.rollback = AsyncMock()
    monkeypatch.setattr(catalog, "get_category", AsyncMock(return_value=category_obj))
    monkeypatch.setattr(catalog, "get_category_by_name_or_slug", AsyncMock(return_value=None))
    monkeypatch.setattr(catalog, "record_moderator_action", AsyncMock())
    with pytest.raises(ConflictError):
        await catalog.update_category(db, 1, {"name":"New"}, "m1")
    db.rollback.assert_awaited()


@pytest.mark.asyncio
async def test_catalog_delete_paths(monkeypatch):
    db = MagicMock(); db.scalar = AsyncMock(side_effect=[False, False]); db.commit = AsyncMock(); db.delete = AsyncMock()
    monkeypatch.setattr(catalog, "get_category", AsyncMock(return_value=SimpleNamespace(id=1,name="Custom",slug="custom",is_builtin=False)))
    monkeypatch.setattr(catalog, "record_moderator_action", AsyncMock())
    await catalog.delete_category(db, 1, "m1")
    db.delete.assert_awaited_once()
    monkeypatch.setattr(catalog, "get_category", AsyncMock(return_value=None))
    with pytest.raises(NotFoundError): await catalog.delete_category(db, 1, "m1")
    monkeypatch.setattr(catalog, "get_category", AsyncMock(return_value=SimpleNamespace(is_builtin=True)))
    with pytest.raises(ConflictError): await catalog.delete_category(db, 1, "m1")
    monkeypatch.setattr(catalog, "get_category", AsyncMock(return_value=SimpleNamespace(id=1,name="x",slug="x",is_builtin=False)))
    db.scalar = AsyncMock(return_value=True)
    with pytest.raises(ConflictError): await catalog.delete_category(db, 1, "m1")


@pytest.mark.asyncio
async def test_catalog_delete_integrity(monkeypatch):
    db = MagicMock(); db.scalar = AsyncMock(side_effect=[False, False]); db.delete = AsyncMock(); db.commit = AsyncMock(side_effect=IntegrityError("stmt", {}, Exception())); db.rollback = AsyncMock()
    monkeypatch.setattr(catalog, "get_category", AsyncMock(return_value=SimpleNamespace(id=1,name="x",slug="x",is_builtin=False)))
    monkeypatch.setattr(catalog, "record_moderator_action", AsyncMock())
    with pytest.raises(ConflictError): await catalog.delete_category(db, 1, "m1")


@pytest.mark.asyncio
async def test_point_services_paths(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr(points, "list_points", AsyncMock(return_value=(["row"], 1)))
    monkeypatch.setattr(points, "list_moderator_points", AsyncMock(return_value=(["row"], 1)))
    monkeypatch.setattr(points, "nearby_points", AsyncMock(return_value=["nearby"]))
    assert await points.fetch_points(db, x=1) == {"rows":["row"],"total":1}
    assert await points.fetch_moderator_points(db, x=1) == {"rows":["row"],"total":1}
    assert await points.fetch_nearby_points(db, x=1) == ["nearby"]
    monkeypatch.setattr(points, "get_point", AsyncMock(return_value=None))
    with pytest.raises(NotFoundError): await points.fetch_point(db, 1)
    monkeypatch.setattr(points, "get_point", AsyncMock(return_value=(SimpleNamespace(id=1), 1, 2)))
    assert (await points.fetch_point(db, 1))[0].id == 1


@pytest.mark.asyncio
async def test_point_update_paths(monkeypatch):
    point = SimpleNamespace(id=1, title="Old", category_id=1, location=None)
    db = MagicMock(); db.commit = AsyncMock()
    monkeypatch.setattr(points, "get_point", AsyncMock(return_value=(point, 46.0, 51.5)))
    monkeypatch.setattr(points, "get_active_category", AsyncMock(return_value=SimpleNamespace(id=2)))
    monkeypatch.setattr(points, "make_location", lambda lat, lon: (lat, lon))
    monkeypatch.setattr(points, "record_moderator_action", AsyncMock())
    monkeypatch.setattr(points, "fetch_point", AsyncMock(return_value=(point, 46.1, 51.6)))
    changes = {"title":"New","category_id":2,"latitude":51.6,"longitude":46.1}
    result = await points.update_point(db, 1, changes, "m1")
    assert result[0].title == "New" and point.location == (51.6,46.1)
    assert "latitude" not in changes and "longitude" not in changes


@pytest.mark.asyncio
async def test_point_update_missing_category_and_point(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr(points, "get_point", AsyncMock(return_value=None))
    with pytest.raises(NotFoundError): await points.update_point(db, 1, {"title":"x"}, "m1")
    point = SimpleNamespace(id=1, category_id=1, location=None)
    monkeypatch.setattr(points, "get_point", AsyncMock(return_value=(point, 1, 2)))
    monkeypatch.setattr(points, "get_active_category", AsyncMock(return_value=None))
    with pytest.raises(NotFoundError): await points.update_point(db, 1, {"category_id":2}, "m1")


@pytest.mark.asyncio
async def test_hide_and_restore_paths(monkeypatch):
    db = MagicMock(); db.commit = AsyncMock()
    active = SimpleNamespace(id=1,is_active=True,category_id=1)
    monkeypatch.setattr(points, "get_point", AsyncMock(return_value=(active,1,2)))
    monkeypatch.setattr(points, "record_moderator_action", AsyncMock())
    await points.hide_point(db,1,"m1")
    assert active.is_active is False
    active.is_active = False
    with pytest.raises(ConflictError): await points.hide_point(db,1,"m1")
    monkeypatch.setattr(points, "get_point", AsyncMock(return_value=None))
    with pytest.raises(NotFoundError): await points.hide_point(db,1,"m1")
    monkeypatch.setattr(points, "get_point", AsyncMock(return_value=(active,1,2)))
    monkeypatch.setattr(points, "get_active_category", AsyncMock(return_value=None))
    with pytest.raises(ConflictError): await points.restore_point(db,1,"m1")
    monkeypatch.setattr(points, "get_active_category", AsyncMock(return_value=SimpleNamespace(id=1)))
    monkeypatch.setattr(points, "fetch_point", AsyncMock(return_value=(active,1,2)))
    assert await points.restore_point(db,1,"m1")
    active.is_active = True
    with pytest.raises(ConflictError): await points.restore_point(db,1,"m1")


@pytest.mark.asyncio
async def test_point_request_service_paths(monkeypatch):
    db = MagicMock(); db.commit = AsyncMock(); db.refresh = AsyncMock(); db.add = MagicMock()
    category_obj = SimpleNamespace(id=1)
    monkeypatch.setattr(point_requests, "get_active_category", AsyncMock(return_value=category_obj))
    request = await point_requests.submit_request(db, {"author_name":"A","title":"T","description":"D","category_id":1,"latitude":1,"longitude":2,"event_at":datetime.now(timezone.utc)})
    assert request.author_external_id == "web:anonymous"
    monkeypatch.setattr(point_requests, "get_request", AsyncMock(return_value=request))
    assert await point_requests.fetch_request(db, request.id) is request
    monkeypatch.setattr(point_requests, "list_requests", AsyncMock(return_value=([request],1)))
    assert await point_requests.fetch_requests(db, status_value=None, category_id=None, created_after=None, created_before=None, limit=10, offset=0) == {"rows":[request],"total":1}


@pytest.mark.asyncio
async def test_point_request_submit_missing_category(monkeypatch):
    db = MagicMock(); monkeypatch.setattr(point_requests, "get_active_category", AsyncMock(return_value=None))
    with pytest.raises(NotFoundError): await point_requests.submit_request(db, {"category_id":1})


@pytest.mark.asyncio
async def test_point_request_update_approve_reject(monkeypatch):
    request = SimpleNamespace(id=1,status=PointRequestStatus.PENDING,category_id=1,title="T",description="D",latitude=1,longitude=2,event_at=datetime.now(timezone.utc),author_name="A",point_id=None,moderated_by=None,moderated_at=None,rejection_reason=None)
    db = MagicMock(); db.commit = AsyncMock(); db.refresh = AsyncMock(); db.add = MagicMock(); db.flush = AsyncMock()
    monkeypatch.setattr(point_requests, "get_request", AsyncMock(return_value=request))
    monkeypatch.setattr(point_requests, "get_active_category", AsyncMock(return_value=SimpleNamespace(id=1)))
    monkeypatch.setattr(point_requests, "record_moderator_action", AsyncMock())
    db.add.side_effect = lambda obj: setattr(obj, "id", 99)
    assert await point_requests.update_request(db,1,{"title":"New"},"m1") is request
    request.status = PointRequestStatus.APPROVED
    with pytest.raises(ConflictError): await point_requests.update_request(db,1,{"title":"x"},"m1")
    request.status = PointRequestStatus.PENDING
    monkeypatch.setattr(point_requests, "make_location", lambda lat,lon: (lat,lon))
    approved = await point_requests.approve_request(db,1,"m1")
    assert approved.status == PointRequestStatus.APPROVED and approved.point_id is not None
    request.status = PointRequestStatus.PENDING
    rejected = await point_requests.reject_request(db,1,"m1","reason")
    assert rejected.status == PointRequestStatus.REJECTED and rejected.rejection_reason == "reason"


@pytest.mark.asyncio
async def test_point_request_missing_and_integrity(monkeypatch):
    db = MagicMock(); db.commit = AsyncMock(); db.rollback = AsyncMock(); db.flush = AsyncMock(side_effect=IntegrityError("stmt", {}, Exception())); db.add = MagicMock()
    monkeypatch.setattr(point_requests, "get_request", AsyncMock(return_value=None))
    with pytest.raises(NotFoundError): await point_requests.fetch_request(db,1)
    with pytest.raises(NotFoundError): await point_requests.update_request(db,1,{},"m1")
    monkeypatch.setattr(point_requests, "get_request", AsyncMock(return_value=SimpleNamespace(id=1,status=PointRequestStatus.PENDING,category_id=1,title="T",description="D",latitude=1,longitude=2,event_at=datetime.now(timezone.utc),author_name="A",point_id=None)))
    monkeypatch.setattr(point_requests, "record_moderator_action", AsyncMock())
    monkeypatch.setattr(point_requests, "make_location", lambda a,b:(a,b))
    with pytest.raises(ConflictError): await point_requests.approve_request(db,1,"m1")


@pytest.mark.asyncio
async def test_auth_create_moderator_and_constraints(monkeypatch):
    db = MagicMock(); db.scalar = AsyncMock(return_value=None); db.add = MagicMock(); db.commit = AsyncMock(); db.refresh = AsyncMock()
    moderator = await auth.create_moderator(db," Admin ","very-long-password")
    assert moderator.username == "admin"
    db.scalar = AsyncMock(return_value="existing")
    with pytest.raises(ValueError, match="Only one"):
        await auth.create_moderator(db,"second","very-long-password")
    db.scalar = AsyncMock(return_value=None)
    with pytest.raises(ValueError): await auth.create_moderator(db," ","very-long-password")
    with pytest.raises(ValueError): await auth.create_moderator(db,"admin","short")
    with pytest.raises(ValueError): await auth.create_moderator(db,"admin","x"*1025)


@pytest.mark.asyncio
async def test_auth_login_and_csrf_context(monkeypatch):
    session = SimpleNamespace(moderator_id=None, token_hash="", csrf_token_hash=auth._hash("csrf"), last_activity_at=None, expires_at=None)
    moderator = SimpleNamespace(id="m1",username="admin",is_active=True,password_hash="hash")
    db = MagicMock(); db.commit = AsyncMock()
    monkeypatch.setattr(auth, "get_session_from_request", AsyncMock(return_value=session))
    monkeypatch.setattr(auth, "get_moderator_by_username", AsyncMock(return_value=moderator))
    monkeypatch.setattr(auth, "validate_csrf", AsyncMock())
    monkeypatch.setattr(auth, "_password_hasher", SimpleNamespace(verify=lambda h, p: True))
    monkeypatch.setattr(auth, "_new_token", lambda: "token")
    request = MagicMock(); response = MagicMock()
    result, csrf = await auth.login(db,request,response,"admin","password","csrf")
    assert result is moderator and csrf == "token" and session.moderator_id == "m1"
    monkeypatch.setattr(auth, "get_session_from_request", AsyncMock(return_value=None))
    with pytest.raises(Exception): await auth.login(db,request,response,"admin","password","csrf")


@pytest.mark.asyncio
async def test_auth_login_invalid_password_and_inactive(monkeypatch):
    session = SimpleNamespace(moderator_id=None, csrf_token_hash=auth._hash("csrf"))
    db = MagicMock()
    monkeypatch.setattr(auth, "get_session_from_request", AsyncMock(return_value=session))
    monkeypatch.setattr(auth, "validate_csrf", AsyncMock())
    monkeypatch.setattr(auth, "get_moderator_by_username", AsyncMock(return_value=None))
    with pytest.raises(Exception) as exc: await auth.login(db,MagicMock(),MagicMock(),"admin","bad","csrf")
    assert getattr(exc.value,"status_code",None) == 401


@pytest.mark.asyncio
async def test_approve_request_persists_point_and_audit_metadata(monkeypatch):
    event_at = datetime(2026, 12, 1, 12, 0, tzinfo=timezone.utc)
    request = SimpleNamespace(
        id=41, status=PointRequestStatus.PENDING, category_id=7,
        title="Festival", description="City event", latitude=51.5,
        longitude=46.0, event_at=event_at, author_name="Author",
        point_id=None, moderated_by=None, moderated_at=None,
    )
    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    created = []

    def add_and_assign_id(obj):
        created.append(obj)
        if isinstance(obj, Point):
            obj.id = 901

    db.add.side_effect = add_and_assign_id
    audit = AsyncMock()
    monkeypatch.setattr(point_requests, "get_request", AsyncMock(return_value=request))
    monkeypatch.setattr(point_requests, "record_moderator_action", audit)

    result = await point_requests.approve_request(db, 41, "moderator-1")

    assert result is request
    assert len(created) == 1
    created_point = created[0]
    assert created_point.title == "Festival"
    assert created_point.description == "City event"
    assert created_point.category_id == 7
    assert created_point.event_at == event_at
    assert created_point.author_name == "Author"
    assert created_point.is_active is True
    assert request.status == PointRequestStatus.APPROVED
    assert request.point_id == 901
    assert request.moderated_by == "moderator-1"
    assert request.moderated_at is not None
    db.flush.assert_awaited_once()
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(request)
    audit.assert_awaited_once()
    assert audit.await_args.kwargs["action"] == "request.approved"
    assert audit.await_args.kwargs["details"] == {"point_id": 901}


@pytest.mark.asyncio
async def test_reject_request_persists_reason_and_audit(monkeypatch):
    request = SimpleNamespace(
        id=42, status=PointRequestStatus.PENDING, rejection_reason=None,
        moderated_by=None, moderated_at=None,
    )
    db = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    audit = AsyncMock()
    monkeypatch.setattr(point_requests, "get_request", AsyncMock(return_value=request))
    monkeypatch.setattr(point_requests, "record_moderator_action", audit)

    result = await point_requests.reject_request(db, 42, "moderator-2", "Not relevant")

    assert result is request
    assert request.status == PointRequestStatus.REJECTED
    assert request.rejection_reason == "Not relevant"
    assert request.moderated_by == "moderator-2"
    assert request.moderated_at is not None
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(request)
    audit.assert_awaited_once()
    assert audit.await_args.kwargs["action"] == "request.rejected"
    assert audit.await_args.kwargs["details"] == {"reason": "Not relevant"}

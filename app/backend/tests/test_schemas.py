from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.backend.schemas.auth import LoginRequest
from app.backend.schemas.category import CategoryCreate, CategoryUpdate
from app.backend.schemas.point import PointCreate, PointUpdate
from app.backend.schemas.point_request import PointRequestCreate, PointRequestReject, PointRequestUpdate


@pytest.mark.parametrize("value", ["", "   ", "bad slug", "a_b", "-bad", "bad-"])
def test_category_create_rejects_invalid_slug_or_blank_name(value):
    with pytest.raises(ValidationError):
        CategoryCreate.model_validate({"name": " Test ", "slug": value})


def test_login_request_valid_and_extra_forbidden():
    item = LoginRequest(username=" admin ", password="secret")
    assert item.username == " admin "
    with pytest.raises(ValidationError):
        LoginRequest(username="admin", password="secret", extra="x")


def test_category_create_normalizes_fields():
    item = CategoryCreate(name="  Parks ", slug=" Parks-1 ")
    assert item.name == "Parks"
    assert item.slug == "parks-1"


def test_category_update_requires_change_and_normalizes():
    with pytest.raises(ValidationError):
        CategoryUpdate.model_validate({})
    with pytest.raises(ValidationError):
        CategoryUpdate.model_validate({"name": None})
    with pytest.raises(ValidationError):
        CategoryUpdate.model_validate({"slug": "bad_slug"})
    assert CategoryUpdate(name="  New Name ").name == "New Name"
    assert CategoryUpdate(slug=" NEW-SLUG ").slug == "new-slug"
    assert CategoryUpdate(is_active=False).is_active is False


def test_point_update_validates_coordinates_and_timezone():
    with pytest.raises(ValidationError):
        PointUpdate.model_validate({})
    with pytest.raises(ValidationError):
        PointUpdate(latitude=51.5)
    with pytest.raises(ValidationError):
        PointUpdate(event_at=datetime(2026, 1, 1))
    item = PointUpdate(title="  Event ", latitude=51.5, longitude=46.0, event_at=datetime(2099, 1, 1, tzinfo=timezone.utc))
    assert item.title == "Event"


def test_point_request_create_and_update_validation():
    valid = {"author_name":"  Ivan ","title":"  Event ","description":"  Description ","category_id":1,"latitude":51.5,"longitude":46.0,"event_at":"2026-01-01T12:00:00Z"}
    item = PointRequestCreate.model_validate(valid)
    assert item.author_name == "Ivan"
    with pytest.raises(ValidationError):
        PointRequestCreate.model_validate({**valid, "event_at":"2026-01-01T00:00:00"})
    with pytest.raises(ValidationError):
        PointRequestCreate.model_validate({**valid, "latitude":91})
    with pytest.raises(ValidationError):
        PointRequestCreate.model_validate({**valid, "extra":1})
    with pytest.raises(ValidationError):
        PointRequestUpdate.model_validate({})
    with pytest.raises(ValidationError):
        PointRequestUpdate.model_validate({"latitude":1})
    with pytest.raises(ValidationError):
        PointRequestUpdate.model_validate({"title":None})


def test_point_request_reject_normalizes_and_validates():
    assert PointRequestReject(reason="  reason  ").reason == "reason"
    with pytest.raises(ValidationError):
        PointRequestReject(reason=" ")


def test_permanent_place_schema_allows_missing_date():
    item = PointCreate(
        title="Park", description="Always open", category_id=1,
        latitude=51.5, longitude=46.0, point_type="permanent",
    )
    assert item.event_at is None


def test_orm_schema_serializes_attributes():
    from app.backend.schemas.category import CategoryRead
    obj = type("Obj", (), {"id":1,"name":"Parks","slug":"parks"})()
    item = CategoryRead.model_validate(obj)
    assert item.id == 1

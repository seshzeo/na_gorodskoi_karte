import pytest
from pydantic import ValidationError

from app.backend.schemas.auth import LoginRequest
from app.backend.schemas.category import CategoryUpdate
from app.backend.schemas.point import PointUpdate
from app.backend.schemas.point_request import PointRequestCreate


def test_login_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        LoginRequest(username="moderator", password="long-password", is_admin=True)


def test_category_update_accepts_active_flag():
    payload = CategoryUpdate(is_active=False)
    assert payload.is_active is False


def test_category_update_does_not_allow_builtin_flag_from_client():
    with pytest.raises(ValidationError):
        CategoryUpdate(is_builtin=True)


def test_point_update_requires_coordinates_as_pair():
    with pytest.raises(ValidationError):
        PointUpdate(latitude=51.5)


def test_point_update_accepts_coordinate_pair():
    payload = PointUpdate(latitude=51.5, longitude=46.0)
    assert payload.latitude == 51.5
    assert payload.longitude == 46.0


def test_point_update_requires_timezone_aware_event_datetime():
    with pytest.raises(ValidationError):
        PointUpdate(event_at="2026-11-10T18:00:00")



def test_point_update_rejects_future_event_datetime():
    with pytest.raises(ValidationError, match="event_at must be in the past"):
        PointUpdate(event_at="2099-11-10T18:00:00+04:00")


def test_point_request_create_rejects_future_event_datetime():
    with pytest.raises(ValidationError, match="event_at must be in the past"):
        PointRequestCreate(
            author_name="Тестовый автор",
            title="Вымышленное событие",
            description="Тестовое описание",
            category_id=1,
            latitude=52.0,
            longitude=47.8,
            event_at="2099-11-10T18:00:00+04:00",
        )


def test_point_request_create_accepts_past_event_datetime():
    payload = PointRequestCreate(
        author_name="Тестовый автор",
        title="Вымышленное событие",
        description="Тестовое описание",
        category_id=1,
        latitude=52.0,
        longitude=47.8,
        event_at="2020-01-01T12:00:00+04:00",
    )
    assert payload.event_at.year == 2020

import pytest


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("GET", "/api/v1/moderator/categories", None),
        ("GET", "/api/v1/moderator/points", None),
        ("GET", "/api/v1/moderator/points/1", None),
        ("PATCH", "/api/v1/moderator/points/1", {"title": "Changed"}),
        ("DELETE", "/api/v1/moderator/points/1", None),
        ("POST", "/api/v1/moderator/points/1/restore", None),
        ("GET", "/api/v1/point-requests", None),
        ("GET", "/api/v1/point-requests/1", None),
        ("PATCH", "/api/v1/point-requests/1", {"title": "Changed"}),
        ("POST", "/api/v1/point-requests/1/approve", None),
        ("POST", "/api/v1/point-requests/1/reject", {"reason": "invalid"}),
        ("GET", "/api/v1/moderator/audit-logs", None),
        ("PATCH", "/api/v1/points/1", {"title": "Changed"}),
        ("DELETE", "/api/v1/points/1", None),
        ("POST", "/api/v1/points/1/restore", None),
    ],
)
async def test_moderator_routes_reject_anonymous_requests(anonymous_client, method, path, payload):
    response = await anonymous_client.request(method, path, json=payload)
    assert response.status_code == 401, response.text
    assert response.json()["code"] == "unauthorized"

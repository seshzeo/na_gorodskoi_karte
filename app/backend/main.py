from fastapi import FastAPI

from app.backend.core.config import settings
from app.backend.routers.categories import router as categories_router
from app.backend.routers.health import router as health_router
from app.backend.routers.point_requests import router as point_requests_router
from app.backend.routers.points import router as points_router

app = FastAPI(
    title=settings.app_name,
    version="0.3.0",
    description="Backend сервиса интерактивной карты и пользовательских точек.",
)

for router in (
    health_router,
    categories_router,
    points_router,
    point_requests_router,
):
    app.include_router(router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    return {"message": "Map Points API", "docs": "/docs"}

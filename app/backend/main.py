from fastapi import FastAPI

from app.backend.core.config import settings
from app.backend.routers.health import router as health_router

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Backend сервиса интерактивной карты и пользовательских точек.",
)
app.include_router(health_router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    return {"message": "Map Points API", "docs": "/docs"}

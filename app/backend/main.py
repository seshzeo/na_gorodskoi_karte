from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.backend.core.config import settings
from app.backend.routers.auth import router as auth_router
from app.backend.routers.categories import (
    moderator_categories_router,
    router as categories_router,
)
from app.backend.routers.health import router as health_router
from app.backend.routers.point_requests import router as point_requests_router
from app.backend.routers.points import (
    moderator_points_router,
    router as points_router,
)


def _error_code(status_code: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        405: "method_not_allowed",
        409: "conflict",
        422: "validation_error",
        429: "too_many_requests",
        503: "service_unavailable",
    }.get(status_code, "http_error")


app = FastAPI(
    title=settings.app_name,
    version="0.6.0",
    description="Backend сервиса интерактивной карты и пользовательских точек.",
    openapi_tags=[
        {"name": "health", "description": "Проверка состояния API и базы данных."},
        {"name": "auth", "description": "Сессионная авторизация модератора."},
        {"name": "categories", "description": "Публичный каталог категорий и операции модератора."},
        {"name": "points", "description": "Публичные точки карты и операции модератора."},
        {"name": "moderator points", "description": "Административный каталог активных и архивных точек."},
        {"name": "point requests", "description": "Пользовательские заявки и их модерация."},
        {"name": "root", "description": "Служебная информация API."},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": _error_code(exc.status_code),
            "detail": jsonable_encoder(exc.detail),
        },
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "code": "validation_error",
            "detail": jsonable_encoder(exc.errors()),
        },
    )


for router in (
    health_router,
    auth_router,
    categories_router,
    moderator_categories_router,
    points_router,
    moderator_points_router,
    point_requests_router,
):
    app.include_router(router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    return {"message": "Map Points API", "docs": "/docs"}

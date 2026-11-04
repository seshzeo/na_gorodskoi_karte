from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.backend.core.config import settings
from app.backend.routers.categories import router as categories_router
from app.backend.routers.health import router as health_router
from app.backend.routers.point_requests import router as point_requests_router
from app.backend.routers.points import router as points_router


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
    version="0.4.0",
    description="Backend сервиса интерактивной карты и пользовательских точек.",
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": _error_code(exc.status_code),
            "detail": exc.detail,
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
            "detail": exc.errors(),
        },
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

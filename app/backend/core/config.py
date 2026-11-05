from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_name: str = "Map Points API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/map_points"

    session_cookie_name: str = "moderator_session"
    session_idle_timeout_seconds: int = 86400
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"
    cors_origins: list[str] = ["http://localhost:5173"]

    @field_validator("session_idle_timeout_seconds")
    @classmethod
    def validate_session_timeout(cls, value: int) -> int:
        if value < 60:
            raise ValueError("SESSION_IDLE_TIMEOUT_SECONDS must be at least 60")
        return value

    @field_validator("session_cookie_samesite")
    @classmethod
    def validate_samesite(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"lax", "strict", "none"}:
            raise ValueError("SESSION_COOKIE_SAMESITE must be lax, strict or none")
        return normalized

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_cookie_security(self):
        if self.session_cookie_samesite == "none" and not self.session_cookie_secure:
            raise ValueError("SameSite=None requires SESSION_COOKIE_SECURE=true")
        if self.app_env.strip().lower() == "production" and not self.session_cookie_secure:
            raise ValueError("SESSION_COOKIE_SECURE=true is required in production")
        return self

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        enable_decoding=False,
    )


settings = Settings()

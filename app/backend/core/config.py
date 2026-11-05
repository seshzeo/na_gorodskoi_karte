from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    app_name: str = "Map Points API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/map_points"
    moderator_api_key: str | None = None

    @field_validator("moderator_api_key", mode="before")
    @classmethod
    def validate_moderator_api_key(cls, value):
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if len(value) < 32:
            raise ValueError("MODERATOR_API_KEY must contain at least 32 characters")
        return value

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

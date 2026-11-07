from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.backend.schemas.common import ORMModel


class PointRead(ORMModel):
    id: int
    title: str
    description: str
    category_id: int
    category_name: str
    latitude: float
    longitude: float
    point_type: Literal["event", "permanent"]
    event_at: datetime | None
    author_name: str
    created_at: datetime
    updated_at: datetime


class PointPage(BaseModel):
    items: list[PointRead]
    total: int
    limit: int
    offset: int


class ModeratorPointRead(PointRead):
    is_active: bool


class ModeratorPointPage(BaseModel):
    items: list[ModeratorPointRead]
    total: int
    limit: int
    offset: int


class PointNearbyRead(PointRead):
    distance_m: float


class PointCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    category_id: int = Field(gt=0)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    point_type: Literal["event", "permanent"] = "permanent"
    event_at: datetime | None = None
    author_name: str = Field(default="Модератор", min_length=1, max_length=120)

    @field_validator("title", "description", "author_name", mode="before")
    @classmethod
    def normalize_text(cls, value):
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized

    @model_validator(mode="after")
    def validate_type_date(self):
        if self.point_type == "event":
            if self.event_at is None:
                raise ValueError("event_at is required for events")
            if self.event_at.utcoffset() is None:
                raise ValueError("event_at must include a timezone")
        elif self.event_at is not None:
            raise ValueError("event_at must be omitted for permanent places")
        return self


class PointUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    category_id: int | None = Field(default=None, gt=0)
    event_at: datetime | None = None
    author_name: str | None = Field(default=None, min_length=1, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @field_validator("title", "description", "author_name", mode="before")
    @classmethod
    def normalize_text(cls, value):
        if value is None or not isinstance(value, str):
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized

    @field_validator("event_at")
    @classmethod
    def event_at_must_be_timezone_aware(cls, value):
        if value is not None and value.utcoffset() is None:
            raise ValueError("event_at must include a timezone")
        return value

    @model_validator(mode="after")
    def validate_update(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be supplied together")
        return self

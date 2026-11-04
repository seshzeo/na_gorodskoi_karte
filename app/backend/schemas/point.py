from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.backend.schemas.common import ORMModel


class PointRead(ORMModel):
    id: int
    title: str
    description: str
    category_id: int
    category_name: str
    latitude: float
    longitude: float
    event_at: datetime
    author_name: str
    created_at: datetime
    updated_at: datetime


class PointNearbyRead(PointRead):
    distance_m: float


class PointUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    category_id: int | None = Field(default=None, gt=0)
    event_at: datetime | None = None
    author_name: str | None = Field(default=None, min_length=1, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_update(self):
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be supplied together")
        return self

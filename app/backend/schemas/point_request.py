from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.backend.schemas.common import ORMModel


class PointRequestStatusValue(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PointRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    author_external_id: str | None = Field(default=None, max_length=100)
    author_name: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    category_id: int = Field(gt=0)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    event_at: datetime


class PointRequestUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    author_name: str | None = Field(default=None, min_length=1, max_length=120)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    category_id: int | None = Field(default=None, gt=0)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    event_at: datetime | None = None

    @model_validator(mode="after")
    def validate_update(self):
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be supplied together")
        return self


class PointRequestRead(ORMModel):
    id: int
    author_name: str
    title: str
    description: str
    category_id: int
    latitude: float
    longitude: float
    event_at: datetime
    status: PointRequestStatusValue
    rejection_reason: str | None
    moderated_at: datetime | None
    point_id: int | None
    created_at: datetime


class PointRequestReject(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(min_length=1, max_length=500)

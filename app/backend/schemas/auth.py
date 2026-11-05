from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=1024)


class ModeratorRead(BaseModel):
    id: str
    username: str


class LoginResponse(ModeratorRead):
    csrf_token: str


class CsrfResponse(BaseModel):
    csrf_token: str

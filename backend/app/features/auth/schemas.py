from uuid import UUID

from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: str
    display_name: str
    avatar_url: str | None

    model_config = {"from_attributes": True}


class UserPreferencesResponse(BaseModel):
    notification_preference: str

    model_config = {"from_attributes": True}


class UpdatePreferencesRequest(BaseModel):
    notification_preference: str  # "immediate" | "digest"

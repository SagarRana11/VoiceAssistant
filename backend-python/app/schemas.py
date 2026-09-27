"""Request/response models (Pydantic) — the Python equivalent of TS interfaces, validated at runtime.

Field aliases keep the camelCase JSON contract (`roleId`, `_id`, ...) while Python code uses snake_case.
"""
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

RoleId = Literal["general", "therapist", "health", "career", "fitness", "hrms"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ─── Auth ─────────────────────────────────────────────────────────────────────
class RegisterBody(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    initials: str


class AuthResponse(BaseModel):
    success: bool = True
    token: str
    user: UserOut


class MeResponse(BaseModel):
    success: bool = True
    user: UserOut


# ─── Chat ─────────────────────────────────────────────────────────────────────
class CreateConversationBody(CamelModel):
    role_id: RoleId
    role_name: str = Field(min_length=1)


class SendMessageBody(CamelModel):
    conversation_id: str
    message: str = Field(min_length=1)
    role_id: RoleId


class MessageOut(BaseModel):
    id: str = Field(serialization_alias="_id")
    role: Literal["user", "assistant"]
    content: str
    timestamp: str


class ConversationBase(CamelModel):
    id: str = Field(serialization_alias="_id")
    user_id: str
    role_id: str
    role_name: str
    created_at: str
    updated_at: str


class ConversationOut(ConversationBase):
    messages: list[MessageOut]


class ConversationSummary(ConversationBase):
    message_count: int
    last_message: MessageOut | None


class ConversationResponse(BaseModel):
    success: bool = True
    conversation: ConversationOut


class ConversationListResponse(BaseModel):
    success: bool = True
    conversations: list[ConversationSummary]


class DeleteResponse(BaseModel):
    success: bool = True
    message: str

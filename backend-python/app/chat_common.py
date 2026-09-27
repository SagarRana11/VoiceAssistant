"""Shared conversation helpers for the /api/chat and /api/hrms routers."""
import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .db import Conversation, Message, Session, User, now
from .schemas import ConversationOut, MessageOut

SSE_HEADERS = {"Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no"}


def sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def message_out(m: Message) -> MessageOut:
    return MessageOut(id=str(m.id), role=m.role, content=m.content, timestamp=iso(m.timestamp))


def conversation_fields(c: Conversation) -> dict:
    return dict(
        id=str(c.id),
        user_id=str(c.user_id),
        role_id=c.role_id,
        role_name=c.role_name,
        created_at=iso(c.created_at),
        updated_at=iso(c.updated_at),
    )


def conversation_out(c: Conversation) -> ConversationOut:
    return ConversationOut(**conversation_fields(c), messages=[message_out(m) for m in c.messages])


def conv_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except ValueError:
        raise HTTPException(404, "Conversation not found.")


async def load_conversation(conv_id: str, user: User) -> Conversation:
    async with Session() as s:
        conv = await s.scalar(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conv_uuid(conv_id), Conversation.user_id == user.id)
        )
    if not conv:
        raise HTTPException(404, "Conversation not found.")
    return conv


async def push_message(conv_id: uuid.UUID, role: str, content: str) -> None:
    async with Session() as s:
        s.add(Message(conversation_id=conv_id, role=role, content=content))
        conv = await s.get(Conversation, conv_id)
        if conv:
            conv.updated_at = now()
        await s.commit()

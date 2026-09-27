"""
/api/hrms — HR policy Q&A chat over the company docs (RAG domain `hrms`, see app/hrms_rag.py).

Same conversation storage as /api/chat, but every conversation here has role_id="hrms", and
/api/chat lists exclude them. The SSE stream ends with {done, conversationId, sources}.
"""
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import Field
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from . import llm
from .auth import current_user
from .chat_common import (
    SSE_HEADERS,
    conv_uuid,
    conversation_fields,
    conversation_out,
    load_conversation,
    message_out,
    push_message,
    sse,
)
from .db import Conversation, Session, User
from .hrms_rag import get_hrms_context
from .schemas import (
    CamelModel,
    ConversationListResponse,
    ConversationResponse,
    ConversationSummary,
    DeleteResponse,
)

ROLE_ID, ROLE_NAME = "hrms", "HR Assistant"
SYSTEM_PROMPT = json.loads((Path(__file__).parent / "roles.json").read_text())[ROLE_ID]["systemPrompt"]

router = APIRouter(prefix="/api/hrms", dependencies=[Depends(current_user)])


class HrmsMessageBody(CamelModel):
    conversation_id: str
    message: str = Field(min_length=1)


async def _hrms_conversation(conv_id: str, user: User) -> Conversation:
    conv = await load_conversation(conv_id, user)
    if conv.role_id != ROLE_ID:
        raise HTTPException(404, "Conversation not found.")
    return conv


@router.post("/conversations", status_code=201)
async def create_conversation(user: User = Depends(current_user)) -> ConversationResponse:
    conv = Conversation(user_id=user.id, role_id=ROLE_ID, role_name=ROLE_NAME, messages=[])
    async with Session() as s:
        s.add(conv)
        await s.commit()
    return ConversationResponse(conversation=conversation_out(conv))


@router.get("/conversations")
async def list_conversations(user: User = Depends(current_user)) -> ConversationListResponse:
    async with Session() as s:
        convs = (
            await s.scalars(
                select(Conversation)
                .options(selectinload(Conversation.messages))
                .where(Conversation.user_id == user.id, Conversation.role_id == ROLE_ID)
                .order_by(Conversation.updated_at.desc())
            )
        ).all()
    return ConversationListResponse(
        conversations=[
            ConversationSummary(
                **conversation_fields(c),
                message_count=len(c.messages),
                last_message=message_out(c.messages[-1]) if c.messages else None,
            )
            for c in convs
        ]
    )


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, user: User = Depends(current_user)) -> ConversationResponse:
    return ConversationResponse(conversation=conversation_out(await _hrms_conversation(conv_id, user)))


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, user: User = Depends(current_user)) -> DeleteResponse:
    async with Session() as s:
        res = await s.execute(
            delete(Conversation).where(
                Conversation.id == conv_uuid(conv_id),
                Conversation.user_id == user.id,
                Conversation.role_id == ROLE_ID,
            )
        )
        await s.commit()
    if not res.rowcount:
        raise HTTPException(404, "Conversation not found.")
    return DeleteResponse(message="Conversation deleted.")


@router.post("/message")
async def send_message(body: HrmsMessageBody, user: User = Depends(current_user)):
    conv = await _hrms_conversation(body.conversation_id, user)

    async def stream():
        try:
            text = body.message.strip()
            await push_message(conv.id, "user", text)
            history = [{"role": m.role, "content": m.content} for m in conv.messages]
            history.append({"role": "user", "content": text})

            context, sources = await get_hrms_context(text, history[-4:])
            messages = [{"role": "system", "content": SYSTEM_PROMPT + context}, *history[-6:]]

            full = ""
            async for chunk in llm.stream_chat(messages, ROLE_ID):
                full += chunk
                yield sse({"content": chunk})

            await push_message(conv.id, "assistant", full)
            yield sse({"done": True, "conversationId": str(conv.id), "sources": sources})
        except Exception as err:
            yield sse({"error": str(err)})

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)

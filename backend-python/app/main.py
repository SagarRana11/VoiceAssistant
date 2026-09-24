"""
Python chat backend — FastAPI port of backend/src/routes/chat.ts.

Standalone: /api/auth (register/login/me) + /api/chat, backed by Postgres (pgvector for RAG).
No dependency on the Node backend.
"""
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from . import llm
from .auth import current_user
from .auth_routes import router as auth_router
from .config import CLIENT_URL, PORT
from .db import Conversation, Message, Session, User, init_db, now
from .rag import get_rag_context
from .schemas import (
    ConversationListResponse,
    ConversationOut,
    ConversationResponse,
    ConversationSummary,
    CreateConversationBody,
    DeleteResponse,
    MessageOut,
    SendMessageBody,
)

ROLES = json.loads((Path(__file__).parent / "roles.json").read_text())


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Voice Assistant Chat (Python)", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CLIENT_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization"],
)


# Match Express error shape: { message }
@app.exception_handler(HTTPException)
async def http_error(_req: Request, exc: HTTPException):
    return JSONResponse({"message": exc.detail}, status_code=exc.status_code)


# Pydantic body validation → 400 { message } (instead of FastAPI's default 422 detail list)
@app.exception_handler(RequestValidationError)
async def validation_error(_req: Request, exc: RequestValidationError):
    err = exc.errors()[0]
    field = ".".join(str(p) for p in err["loc"] if p != "body")
    return JSONResponse({"message": f"{field}: {err['msg']}" if field else err["msg"]}, status_code=400)


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


router = APIRouter(prefix="/api/chat", dependencies=[Depends(current_user)])


@router.post("/conversations", status_code=201)
async def create_conversation(
    body: CreateConversationBody, user: User = Depends(current_user)
) -> ConversationResponse:
    conv = Conversation(user_id=user.id, role_id=body.role_id, role_name=body.role_name, messages=[])
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
                .where(Conversation.user_id == user.id)
                .order_by(Conversation.updated_at.desc())
            )
        ).all()
    summaries = [
        ConversationSummary(
            **conversation_fields(c),
            message_count=len(c.messages),
            last_message=message_out(c.messages[-1]) if c.messages else None,
        )
        for c in convs
    ]
    return ConversationListResponse(conversations=summaries)


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, user: User = Depends(current_user)) -> ConversationResponse:
    return ConversationResponse(conversation=conversation_out(await load_conversation(conv_id, user)))


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, user: User = Depends(current_user)) -> DeleteResponse:
    async with Session() as s:
        res = await s.execute(
            delete(Conversation).where(Conversation.id == conv_uuid(conv_id), Conversation.user_id == user.id)
        )
        await s.commit()
    if not res.rowcount:
        raise HTTPException(404, "Conversation not found.")
    return DeleteResponse(message="Conversation deleted.")


async def _push_message(conv_id: uuid.UUID, role: str, content: str) -> None:
    async with Session() as s:
        s.add(Message(conversation_id=conv_id, role=role, content=content))
        conv = await s.get(Conversation, conv_id)
        if conv:
            conv.updated_at = now()
        await s.commit()


# ─── POST /api/chat/message  (SSE streaming) ──────────────────────────────────
@router.post("/message")
async def send_message(body: SendMessageBody, user: User = Depends(current_user)):
    message, role_id = body.message, body.role_id
    conv = await load_conversation(body.conversation_id, user)

    def event(data: dict) -> str:
        return f"data: {json.dumps(data)}\n\n"

    async def stream():
        try:
            text = message.strip()
            await _push_message(conv.id, "user", text)
            history = [{"role": m.role, "content": m.content} for m in conv.messages]
            history.append({"role": "user", "content": text})

            rag_context = await get_rag_context(role_id, message, history[-4:])
            role = ROLES.get(role_id, ROLES["therapist"])
            openai_messages = [{"role": "system", "content": role["systemPrompt"] + rag_context}, *history[-8:]]

            full = ""
            async for chunk in llm.stream_chat(openai_messages, role_id):
                full += chunk
                yield event({"content": chunk})

            await _push_message(conv.id, "assistant", full)
            yield event({"done": True, "conversationId": str(conv.id)})
        except Exception as err:
            yield event({"error": str(err)})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


app.include_router(auth_router)
app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "python-chat", "timestamp": iso(now())}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)

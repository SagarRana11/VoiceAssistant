"""
Python chat backend — FastAPI port of backend/src/routes/chat.ts.

Standalone: /api/auth (register/login/me) + /api/chat, backed by Postgres (pgvector for RAG).
No dependency on the Node backend.
"""
import json
from contextlib import asynccontextmanager
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
from .chat_common import (
    conv_uuid,
    conversation_fields,
    conversation_out,
    iso,
    load_conversation,
    message_out,
    push_message,
)
from .config import CLIENT_URL, PORT
from .db import Conversation, Session, User, init_db, now
from .hrms_routes import router as hrms_router
from .rag import get_rag_context
from .schemas import (
    ConversationListResponse,
    ConversationResponse,
    ConversationSummary,
    CreateConversationBody,
    DeleteResponse,
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
                .where(Conversation.user_id == user.id, Conversation.role_id != "hrms")
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
            await push_message(conv.id, "user", text)
            history = [{"role": m.role, "content": m.content} for m in conv.messages]
            history.append({"role": "user", "content": text})

            rag_context = await get_rag_context(role_id, message, history[-4:])
            role = ROLES.get(role_id, ROLES["general"])
            openai_messages = [{"role": "system", "content": role["systemPrompt"] + rag_context}, *history[-8:]]

            full = ""
            async for chunk in llm.stream_chat(openai_messages, role_id):
                full += chunk
                yield event({"content": chunk})

            await push_message(conv.id, "assistant", full)
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
app.include_router(hrms_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "python-chat", "timestamp": iso(now())}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)

"""
Python chat backend — FastAPI port of backend/src/routes/chat.ts.

Mounted at /api/chat. Auth, users and everything else stay on the Node backend;
this service shares its MongoDB and JWT secret.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from . import llm
from .auth import current_user
from .config import CLIENT_URL, PORT
from .db import conversations
from .rag import get_rag_context

ROLES = json.loads((Path(__file__).parent / "roles.json").read_text())
VALID_ROLES = {"therapist", "health", "career", "fitness"}

app = FastAPI(title="Voice Assistant Chat (Python)")
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


def now() -> datetime:
    return datetime.now(timezone.utc)


def to_json(value):
    """ObjectId → str, datetime → ISO string (what mongoose/Express would send)."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if isinstance(value, dict):
        return {k: to_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_json(v) for v in value]
    return value


def oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(404, "Conversation not found.")


router = APIRouter(prefix="/api/chat", dependencies=[Depends(current_user)])


@router.post("/conversations", status_code=201)
async def create_conversation(body: dict, user: dict = Depends(current_user)):
    role_id, role_name = body.get("roleId"), body.get("roleName")
    if not role_id or not role_name:
        raise HTTPException(400, "roleId and roleName are required.")
    if role_id not in VALID_ROLES:
        raise HTTPException(400, "Invalid roleId.")
    ts = now()
    doc = {"userId": user["id"], "roleId": role_id, "roleName": role_name, "messages": [],
           "createdAt": ts, "updatedAt": ts, "__v": 0}
    doc["_id"] = (await conversations.insert_one(doc)).inserted_id
    return {"success": True, "conversation": to_json(doc)}


@router.get("/conversations")
async def list_conversations(user: dict = Depends(current_user)):
    cursor = conversations.find({"userId": user["id"]}).sort("updatedAt", -1)
    summaries = [
        {
            "_id": c["_id"],
            "roleId": c["roleId"],
            "roleName": c["roleName"],
            "messageCount": len(c["messages"]),
            "lastMessage": c["messages"][-1] if c["messages"] else None,
            "createdAt": c["createdAt"],
            "updatedAt": c["updatedAt"],
        }
        async for c in cursor
    ]
    return {"success": True, "conversations": to_json(summaries)}


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, user: dict = Depends(current_user)):
    conv = await conversations.find_one({"_id": oid(conv_id), "userId": user["id"]})
    if not conv:
        raise HTTPException(404, "Conversation not found.")
    return {"success": True, "conversation": to_json(conv)}


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, user: dict = Depends(current_user)):
    res = await conversations.delete_one({"_id": oid(conv_id), "userId": user["id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Conversation not found.")
    return {"success": True, "message": "Conversation deleted."}


async def _push_message(conv_id: ObjectId, role: str, content: str) -> None:
    ts = now()
    await conversations.update_one(
        {"_id": conv_id},
        {"$push": {"messages": {"_id": ObjectId(), "role": role, "content": content, "timestamp": ts}},
         "$set": {"updatedAt": ts}},
    )


# ─── POST /api/chat/message  (SSE streaming) ──────────────────────────────────
@router.post("/message")
async def send_message(body: dict, user: dict = Depends(current_user)):
    conv_id, message, role_id = body.get("conversationId"), body.get("message"), body.get("roleId")
    if not conv_id or not message or not role_id:
        raise HTTPException(400, "conversationId, message, and roleId are required.")
    conv = await conversations.find_one({"_id": oid(conv_id), "userId": user["id"]})
    if not conv:
        raise HTTPException(404, "Conversation not found.")

    def event(data: dict) -> str:
        return f"data: {json.dumps(data)}\n\n"

    async def stream():
        try:
            text = message.strip()
            await _push_message(conv["_id"], "user", text)
            history = [{"role": m["role"], "content": m["content"]} for m in conv["messages"]]
            history.append({"role": "user", "content": text})

            rag_context = await get_rag_context(role_id, message, history[-4:])
            role = ROLES.get(role_id, ROLES["therapist"])
            openai_messages = [{"role": "system", "content": role["systemPrompt"] + rag_context}, *history[-8:]]

            full = ""
            async for chunk in llm.stream_chat(openai_messages, role_id):
                full += chunk
                yield event({"content": chunk})

            await _push_message(conv["_id"], "assistant", full)
            yield event({"done": True, "conversationId": str(conv["_id"])})
        except Exception as err:
            yield event({"error": str(err)})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "python-chat", "timestamp": now().isoformat()}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, reload=True)

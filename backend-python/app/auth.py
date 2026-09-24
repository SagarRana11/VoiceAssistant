"""Verifies the JWT issued by the Node auth service (same secret, same payload)."""
import jwt
from bson import ObjectId
from fastapi import Header, HTTPException

from .config import JWT_SECRET
from .db import users


async def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Access denied. No token provided.")
    try:
        payload = jwt.decode(authorization.split(" ", 1)[1], JWT_SECRET, algorithms=["HS256"])
        user = await users.find_one({"_id": ObjectId(payload["id"])}, {"name": 1, "email": 1})
    except Exception:
        raise HTTPException(401, "Invalid or expired token.")
    if not user:
        raise HTTPException(401, "User not found.")
    return {"id": user["_id"], "name": user.get("name"), "email": user.get("email")}

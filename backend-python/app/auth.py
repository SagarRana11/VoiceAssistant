"""JWT issue/verify + bcrypt password hashing. Tokens carry `{id}` (HS256)."""
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Header, HTTPException

from .config import JWT_EXPIRES_DAYS, JWT_SECRET
from .db import Session, User
from .schemas import UserOut


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()


def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def sign_token(user_id: uuid.UUID) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS)
    return jwt.encode({"id": str(user_id), "exp": exp}, JWT_SECRET, algorithm="HS256")


def format_user(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        name=user.name,
        email=user.email,
        initials="".join(n[0] for n in user.name.split() if n).upper()[:2],
    )


async def current_user(authorization: str | None = Header(default=None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Access denied. No token provided.")
    try:
        payload = jwt.decode(authorization.split(" ", 1)[1], JWT_SECRET, algorithms=["HS256"])
        async with Session() as s:
            user = await s.get(User, uuid.UUID(payload["id"]))
    except Exception:
        raise HTTPException(401, "Invalid or expired token.")
    if not user:
        raise HTTPException(401, "User not found.")
    return user

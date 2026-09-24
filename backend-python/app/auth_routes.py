"""/api/auth — register, login, me. Same contract as the Node authController."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .auth import check_password, current_user, format_user, hash_password, sign_token
from .db import Session, User
from .schemas import AuthResponse, LoginBody, MeResponse, RegisterBody

router = APIRouter(prefix="/api/auth")


@router.post("/register", status_code=201)
async def register(body: RegisterBody) -> AuthResponse:
    user = User(name=body.name, email=body.email.lower(), password_hash=hash_password(body.password))
    async with Session() as s:
        s.add(user)
        try:
            await s.commit()
        except IntegrityError:
            raise HTTPException(409, "An account with this email already exists.")
    return AuthResponse(token=sign_token(user.id), user=format_user(user))


@router.post("/login")
async def login(body: LoginBody) -> AuthResponse:
    async with Session() as s:
        user = await s.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not check_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password.")
    return AuthResponse(token=sign_token(user.id), user=format_user(user))


@router.get("/me")
async def me(user: User = Depends(current_user)) -> MeResponse:
    return MeResponse(user=format_user(user))

"""Auth endpoints — POST /signup, POST /login."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from backend.app.core.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from backend.app.db.database import User, get_db

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────


class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str


class UserResponse(BaseModel):
    user_id: int
    username: str
    email: str


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(body: SignupRequest, db: Annotated[Session, Depends(get_db)]) -> AuthResponse:
    """Create a new user account."""
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username already taken.")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user_id=user.id, username=user.username)


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> AuthResponse:
    """Authenticate with email + password."""
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user_id=user.id, username=user.username)


@router.get("/me", response_model=UserResponse)
def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    """Return the currently authenticated user."""
    return UserResponse(user_id=current_user.id, username=current_user.username, email=current_user.email)

"""Authentication utilities — password hashing, JWT creation/verification, and current-user dependency."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.db.database import User, get_db

# ── Password hashing ──────────────────────────────────────────────────


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT ───────────────────────────────────────────────────────────────

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


class TokenPayload(BaseModel):
    sub: str  # user id as string
    exp: datetime


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> TokenPayload:
    try:
        data = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        return TokenPayload(sub=data["sub"], exp=datetime.fromtimestamp(data["exp"], tz=timezone.utc))
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── OAuth2 scheme ─────────────────────────────────────────────────────

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


# ── FastAPI dependency: get current user ──────────────────────────────

def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    payload = decode_access_token(token)
    user = db.query(User).filter(User.id == int(payload.sub)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found.")
    return user

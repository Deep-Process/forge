"""Auth router — login, token refresh, user info."""

from __future__ import annotations

import hmac
import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import create_access_token, get_current_user
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """Authenticate with username/password and receive a JWT token."""
    if not settings.api_key:
        raise HTTPException(400, "Authentication not configured")

    # Timing-safe comparison for both username and password (F-02)
    username_ok = hmac.compare_digest(body.username, "forge")
    password_ok = hmac.compare_digest(body.password, settings.api_key)

    if username_ok and password_ok:
        token = create_access_token(
            data={"sub": body.username, "role": "admin"},
            expires_delta=timedelta(minutes=settings.jwt_expire_minutes),
        )
        logger.info("Successful login for user: %s", body.username)
        return TokenResponse(
            access_token=token,
            expires_in=settings.jwt_expire_minutes * 60,
        )

    logger.warning("Failed login attempt for user: %s", body.username)
    raise HTTPException(401, "Invalid credentials")


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(user: dict = Depends(get_current_user)):
    """Refresh an existing JWT token (must be authenticated)."""
    if user.get("auth_method") == "none":
        raise HTTPException(401, "Authentication required to refresh token")

    token = create_access_token(
        data={"sub": user["sub"], "role": user.get("role", "user")},
        expires_delta=timedelta(minutes=settings.jwt_expire_minutes),
    )
    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
    )


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Return info about the currently authenticated user."""
    return {
        "sub": user.get("sub"),
        "auth_method": user.get("auth_method"),
        "role": user.get("role", "user"),
    }

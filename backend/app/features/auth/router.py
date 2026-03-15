from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import create_access_token, create_refresh_token, decode_token, get_current_user
from app.core.config import settings
from app.features.auth.schemas import TokenResponse, UserResponse, UserPreferencesResponse, UpdatePreferencesRequest
from app.features.auth import service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google/redirect")
async def google_redirect():
    url = await service.get_google_redirect_url()
    return RedirectResponse(url)


@router.get("/google/callback")
async def google_callback(
    code: str,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    user = await service.exchange_code_for_user(code=code, session=session)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # set True in production
        samesite="lax",
        max_age=60 * 60 * 24 * settings.refresh_token_expire_days,
    )

    redirect_url = f"{settings.frontend_url}/auth/callback?access_token={access_token}"
    return RedirectResponse(redirect_url)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: Request):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    from uuid import UUID
    access_token = create_access_token(UUID(payload["sub"]))
    return TokenResponse(access_token=access_token)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
async def me(current_user=Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.get("/preferences", response_model=UserPreferencesResponse)
async def get_preferences(current_user=Depends(get_current_user)):
    return UserPreferencesResponse.model_validate(current_user)


@router.patch("/preferences", response_model=UserPreferencesResponse)
async def update_preferences(
    body: UpdatePreferencesRequest,
    current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if body.notification_preference not in ("immediate", "digest"):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="notification_preference must be 'immediate' or 'digest'")
    current_user.notification_preference = body.notification_preference
    await session.commit()
    return UserPreferencesResponse.model_validate(current_user)


@router.get("/users/search", response_model=UserResponse | None)
async def search_user_by_email(
    email: str,
    _current_user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Look up a user by exact email — used for workspace member invite."""
    from sqlalchemy import select
    from app.models.user import User
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return None
    return UserResponse.model_validate(user)

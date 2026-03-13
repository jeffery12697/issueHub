"""
DEV ONLY — controlled by ALLOW_DEV_LOGIN env var (default: true).
Set ALLOW_DEV_LOGIN=false in production to disable.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_session
from app.core.security import create_access_token
from app.features.auth.schemas import TokenResponse
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/token", response_model=TokenResponse)
async def dev_token(
    email: str = "dev@example.com",
    display_name: str = "Dev User",
    session: AsyncSession = Depends(get_session),
):
    """Create or fetch a user by email and return an access token. Dev only."""
    if not settings.allow_dev_login:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dev login is disabled")

    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(email=email, display_name=display_name)
        session.add(user)
        await session.flush()

        workspace = Workspace(name=f"{display_name}'s Workspace")
        session.add(workspace)
        await session.flush()

        session.add(WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role=WorkspaceRole.owner,
        ))
        await session.commit()
    else:
        await session.commit()

    return TokenResponse(access_token=create_access_token(user.id))

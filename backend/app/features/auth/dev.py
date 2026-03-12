"""
DEV ONLY — remove before production.
Provides a quick token for testing without Google OAuth.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_session
from app.core.security import create_access_token
from app.features.auth.schemas import TokenResponse
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/token", response_model=TokenResponse)
async def dev_token(email: str = "dev@example.com", session: AsyncSession = Depends(get_session)):
    """Create or fetch a dev user and return an access token."""
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(email=email, display_name="Dev User")
        session.add(user)
        await session.flush()

        workspace = Workspace(name="Dev Workspace")
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

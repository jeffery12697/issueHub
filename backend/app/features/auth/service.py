from authlib.integrations.httpx_client import AsyncOAuth2Client

from app.core.config import settings
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


GOOGLE_CONF_URL = "https://accounts.google.com/.well-known/openid-configuration"


async def get_google_oauth_client() -> AsyncOAuth2Client:
    return AsyncOAuth2Client(
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        redirect_uri=settings.google_redirect_uri,
    )


async def get_google_redirect_url() -> str:
    client = await get_google_oauth_client()
    conf = await _fetch_google_config()
    url, _ = client.create_authorization_url(
        conf["authorization_endpoint"],
        scope="openid email profile",
    )
    return url


async def exchange_code_for_user(code: str, session: AsyncSession) -> User:
    client = await get_google_oauth_client()
    conf = await _fetch_google_config()

    token = await client.fetch_token(conf["token_endpoint"], code=code)
    userinfo = await client.get(conf["userinfo_endpoint"])
    userinfo = userinfo.json()

    return await upsert_user(
        session=session,
        email=userinfo["email"],
        display_name=userinfo.get("name", userinfo["email"]),
        avatar_url=userinfo.get("picture"),
        google_sub=userinfo["sub"],
    )


async def upsert_user(
    session: AsyncSession,
    email: str,
    display_name: str,
    avatar_url: str | None,
    google_sub: str,
) -> User:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
            google_sub=google_sub,
        )
        session.add(user)
    else:
        user.display_name = display_name
        user.avatar_url = avatar_url
        user.google_sub = google_sub

    await session.commit()
    await session.refresh(user)
    return user


async def _fetch_google_config() -> dict:
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get(GOOGLE_CONF_URL)
        return resp.json()

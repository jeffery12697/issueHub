from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)

AsyncSessionFactory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Alias used by background jobs
AsyncSessionLocal = AsyncSessionFactory


async def get_session() -> AsyncSession:
    async with AsyncSessionFactory() as session:
        yield session

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.features.auth.router import router as auth_router
from app.features.auth.dev import router as dev_router
from app.features.workspaces.router import router as workspaces_router
from app.features.projects.router import router as projects_router
from app.features.lists.router import router as lists_router
from app.features.tasks.router import router as tasks_router
from app.features.audit.router import router as audit_router

app = FastAPI(title="IssueHub API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(dev_router, prefix="/api/v1")
app.include_router(workspaces_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(lists_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}

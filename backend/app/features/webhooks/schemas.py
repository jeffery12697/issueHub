"""
Pydantic schemas for GitHub Pull Request and GitLab Merge Request webhook payloads.
Only the fields we actually use are declared; everything else is ignored.
"""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


# ── GitHub ────────────────────────────────────────────────────────────────────

class GitHubHeadBranch(BaseModel):
    ref: str  # branch name


class GitHubPullRequest(BaseModel):
    merged: bool = False
    head: GitHubHeadBranch
    merge_commit_sha: str | None = None
    number: int | None = None
    title: str | None = None
    html_url: str | None = None


class GitHubRepository(BaseModel):
    full_name: str


class GitHubPRPayload(BaseModel):
    action: str          # "opened", "closed", "reopened", ...
    pull_request: GitHubPullRequest
    repository: GitHubRepository


class GitHubReviewUser(BaseModel):
    login: str


class GitHubReview(BaseModel):
    state: str           # "approved", "changes_requested", "commented"
    user: GitHubReviewUser


class GitHubPRReviewPayload(BaseModel):
    action: str          # "submitted", "dismissed", "edited"
    review: GitHubReview
    pull_request: GitHubPullRequest
    repository: GitHubRepository


# ── GitLab ────────────────────────────────────────────────────────────────────

class GitLabMRAttributes(BaseModel):
    action: str          # "open", "merge", "close", "reopen", "approved", ...
    source_branch: str
    merge_commit_sha: str | None = None
    iid: int | None = None  # MR number within the project
    title: str | None = None
    url: str | None = None


class GitLabProject(BaseModel):
    path_with_namespace: str


class GitLabUser(BaseModel):
    name: str | None = None
    username: str | None = None
    email: str | None = None


class GitLabMRPayload(BaseModel):
    object_kind: str     # "merge_request"
    user: GitLabUser | None = None
    object_attributes: GitLabMRAttributes
    project: GitLabProject


# ── Generic result ────────────────────────────────────────────────────────────

class WebhookResult(BaseModel):
    event: str
    platform: str
    branch: str
    task_keys_found: list[str]
    closed: list[str]
    linked: list[str]
    skipped: list[str]
    errors: list[str]


# ── Git link response ─────────────────────────────────────────────────────────

class TaskGitLinkResponse(BaseModel):
    id: UUID
    task_id: UUID
    platform: str
    repo: str
    pr_number: int | None
    pr_title: str | None
    pr_url: str | None
    branch: str
    status: str
    linked_at: datetime
    merged_at: datetime | None

    model_config = {"from_attributes": True}

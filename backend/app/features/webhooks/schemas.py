"""
Pydantic schemas for GitHub Pull Request and GitLab Merge Request webhook payloads.
Only the fields we actually use are declared; everything else is ignored.
"""
from typing import Literal
from pydantic import BaseModel


# ── GitHub ────────────────────────────────────────────────────────────────────

class GitHubHeadBranch(BaseModel):
    ref: str  # branch name


class GitHubPullRequest(BaseModel):
    merged: bool = False
    head: GitHubHeadBranch
    merge_commit_sha: str | None = None
    number: int | None = None


class GitHubRepository(BaseModel):
    full_name: str


class GitHubPRPayload(BaseModel):
    action: str          # "opened", "closed", "reopened", ...
    pull_request: GitHubPullRequest
    repository: GitHubRepository


# ── GitLab ────────────────────────────────────────────────────────────────────

class GitLabMRAttributes(BaseModel):
    action: str          # "open", "merge", "close", "reopen", ...
    source_branch: str
    merge_commit_sha: str | None = None
    iid: int | None = None  # MR number within the project


class GitLabProject(BaseModel):
    path_with_namespace: str


class GitLabMRPayload(BaseModel):
    object_kind: str     # "merge_request"
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

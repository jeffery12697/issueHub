"""
Seed the development database with realistic dummy data.

Usage (from repo root):
    docker compose exec backend python scripts/seed.py

The script is idempotent: if dev@example.com already exists it exits early.

Dev account
-----------
Email : dev@issuehub.app
Token : POST /api/v1/dev/token?email=dev@issuehub.app
        (or run the script and copy the token it prints)
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from uuid import uuid4

# Make sure app package is importable when run inside container
sys.path.insert(0, "/app")

from sqlalchemy import select, text
from sqlalchemy_utils import Ltree

from app.core.database import AsyncSessionFactory
from app.core.security import create_access_token
from app.models.comment import Comment
from app.models.epic import Epic, EpicStatus
from app.models.list_ import List
from app.models.list_status import ListStatus, StatusCategory
from app.models.project import Project
from app.models.tag import Tag, TaskTag
from app.models.task import Priority, Task
from app.models.task_dependency import TaskDependency
from app.models.team import Team, TeamMember, TeamRole
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

NOW = datetime.now(timezone.utc)


def d(days: int) -> datetime:
    """Return a UTC datetime offset from today."""
    return NOW + timedelta(days=days)


def task_path(task_id, parent_path: str | None = None) -> Ltree:
    node = str(task_id).replace("-", "_")
    if parent_path:
        return Ltree(f"{parent_path}.{node}")
    return Ltree(node)


# ---------------------------------------------------------------------------
# Main seed
# ---------------------------------------------------------------------------


async def seed():
    async with AsyncSessionFactory() as s:
        # ── Guard: skip if already seeded ──────────────────────────────────
        existing = (
            await s.execute(select(User).where(User.email == "dev@issuehub.app"))
        ).scalar_one_or_none()
        if existing:
            print("✓ Database already seeded — skipping.")
            token = create_access_token(existing.id)
            print(f"\nDev token (expires in 15 min): {token}")
            return

        print("Seeding …")

        # ── Users ──────────────────────────────────────────────────────────
        dev = User(email="dev@issuehub.app", display_name="Dev (You)", avatar_url=None)
        alice = User(email="alice@issuehub.app", display_name="Alice Chen")
        bob = User(email="bob@issuehub.app", display_name="Bob Tanaka")
        carol = User(email="carol@issuehub.app", display_name="Carol Reyes")
        dave = User(email="dave@issuehub.app", display_name="Dave Kim")
        s.add_all([dev, alice, bob, carol, dave])
        await s.flush()

        # ── Workspace ──────────────────────────────────────────────────────
        ws = Workspace(name="Acme Corp")
        s.add(ws)
        await s.flush()

        members_data = [
            (dev,   WorkspaceRole.owner),
            (alice, WorkspaceRole.admin),
            (bob,   WorkspaceRole.member),
            (carol, WorkspaceRole.member),
            (dave,  WorkspaceRole.member),
        ]
        for user, role in members_data:
            s.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role=role))
        await s.flush()

        # ── Teams ──────────────────────────────────────────────────────────
        eng_team = Team(workspace_id=ws.id, name="Engineering", created_by=dev.id)
        design_team = Team(workspace_id=ws.id, name="Design", created_by=alice.id)
        s.add_all([eng_team, design_team])
        await s.flush()

        s.add_all([
            TeamMember(team_id=eng_team.id, user_id=dev.id,   role=TeamRole.team_admin),
            TeamMember(team_id=eng_team.id, user_id=bob.id,   role=TeamRole.team_member),
            TeamMember(team_id=eng_team.id, user_id=dave.id,  role=TeamRole.team_member),
            TeamMember(team_id=design_team.id, user_id=alice.id, role=TeamRole.team_admin),
            TeamMember(team_id=design_team.id, user_id=carol.id, role=TeamRole.team_member),
        ])
        await s.flush()

        # ── Tags ───────────────────────────────────────────────────────────
        tag_bug      = Tag(workspace_id=ws.id, name="bug",      color="#ef4444")
        tag_feature  = Tag(workspace_id=ws.id, name="feature",  color="#3b82f6")
        tag_ux       = Tag(workspace_id=ws.id, name="ux",       color="#a855f7")
        tag_perf     = Tag(workspace_id=ws.id, name="perf",     color="#f59e0b")
        tag_security = Tag(workspace_id=ws.id, name="security", color="#dc2626")
        tag_tech_debt = Tag(workspace_id=ws.id, name="tech-debt", color="#6b7280")
        tag_docs     = Tag(workspace_id=ws.id, name="docs",     color="#10b981")
        s.add_all([tag_bug, tag_feature, tag_ux, tag_perf, tag_security, tag_tech_debt, tag_docs])
        await s.flush()

        # ── Projects ───────────────────────────────────────────────────────
        proj_web = Project(
            workspace_id=ws.id,
            name="Web App",
            description="Main customer-facing web application",
            task_prefix="WEB",
            next_task_number=1,
        )
        proj_api = Project(
            workspace_id=ws.id,
            name="Backend API",
            description="REST API powering all products",
            task_prefix="API",
            next_task_number=1,
        )
        proj_mobile = Project(
            workspace_id=ws.id,
            name="Mobile App",
            description="iOS & Android React Native app",
            task_prefix="MOB",
            next_task_number=1,
        )
        s.add_all([proj_web, proj_api, proj_mobile])
        await s.flush()

        # ── Lists + Statuses ───────────────────────────────────────────────
        #
        # Each project gets: Backlog, In Progress, Review, Done
        #

        def make_statuses(list_id) -> list[ListStatus]:
            return [
                ListStatus(list_id=list_id, name="Backlog",     color="#6b7280", order_index=0.0,  category=StatusCategory.not_started),
                ListStatus(list_id=list_id, name="In Progress", color="#3b82f6", order_index=1.0,  category=StatusCategory.active),
                ListStatus(list_id=list_id, name="In Review",   color="#f59e0b", order_index=2.0,  category=StatusCategory.active),
                ListStatus(list_id=list_id, name="Done",        color="#22c55e", order_index=3.0,  category=StatusCategory.done, is_complete=True),
                ListStatus(list_id=list_id, name="Cancelled",   color="#ef4444", order_index=4.0,  category=StatusCategory.cancelled),
            ]

        # Web App lists
        list_web_q1   = List(project_id=proj_web.id, name="Q1 Sprint")
        list_web_q2   = List(project_id=proj_web.id, name="Q2 Sprint")
        list_web_bugs = List(project_id=proj_web.id, name="Bug Tracker")

        # API lists
        list_api_core = List(project_id=proj_api.id, name="Core Services")
        list_api_infra = List(project_id=proj_api.id, name="Infrastructure")

        # Mobile lists
        list_mob_v1 = List(project_id=proj_mobile.id, name="v1.0 Release")
        list_mob_v2 = List(project_id=proj_mobile.id, name="v2.0 Roadmap")

        all_lists = [
            list_web_q1, list_web_q2, list_web_bugs,
            list_api_core, list_api_infra,
            list_mob_v1, list_mob_v2,
        ]
        s.add_all(all_lists)
        await s.flush()

        all_statuses: dict[str, dict[str, ListStatus]] = {}
        for lst in all_lists:
            statuses = make_statuses(lst.id)
            s.add_all(statuses)
            await s.flush()
            all_statuses[str(lst.id)] = {st.name: st for st in statuses}

        def st(lst: List, name: str) -> ListStatus:
            return all_statuses[str(lst.id)][name]

        # ── Epics ──────────────────────────────────────────────────────────
        epic_auth = Epic(
            project_id=proj_web.id, workspace_id=ws.id,
            name="Authentication & SSO", color="#6366f1",
            status=EpicStatus.in_progress,
            start_date=d(-30), due_date=d(30),
            order_index=1.0, created_by=dev.id,
        )
        epic_dashboard = Epic(
            project_id=proj_web.id, workspace_id=ws.id,
            name="Analytics Dashboard", color="#f59e0b",
            status=EpicStatus.not_started,
            start_date=d(7), due_date=d(60),
            order_index=2.0, created_by=alice.id,
        )
        epic_perf = Epic(
            project_id=proj_api.id, workspace_id=ws.id,
            name="Performance Hardening", color="#ef4444",
            status=EpicStatus.in_progress,
            start_date=d(-14), due_date=d(21),
            order_index=1.0, created_by=dev.id,
        )
        epic_mobile_launch = Epic(
            project_id=proj_mobile.id, workspace_id=ws.id,
            name="v1.0 Launch Checklist", color="#22c55e",
            status=EpicStatus.not_started,
            start_date=d(0), due_date=d(45),
            order_index=1.0, created_by=bob.id,
        )
        s.add_all([epic_auth, epic_dashboard, epic_perf, epic_mobile_launch])
        await s.flush()

        # ── Tasks ──────────────────────────────────────────────────────────
        #
        # Helper to build a root task and auto-increment project task_number
        #

        task_counters: dict[str, int] = {
            str(proj_web.id):    1,
            str(proj_api.id):    1,
            str(proj_mobile.id): 1,
        }

        def next_key(proj: Project) -> tuple[int, str]:
            n = task_counters[str(proj.id)]
            task_counters[str(proj.id)] += 1
            return n, f"{proj.task_prefix}-{n}"

        def make_task(
            title: str,
            proj: Project,
            lst: List,
            status_name: str,
            reporter: User,
            assignees: list[User] | None = None,
            priority: Priority = Priority.medium,
            due: int | None = None,           # offset in days from today
            start: int | None = None,
            story_points: int | None = None,
            epic: Epic | None = None,
            description: str | None = None,
        ) -> Task:
            num, key = next_key(proj)
            tid = uuid4()
            t = Task(
                id=tid,
                workspace_id=ws.id,
                project_id=proj.id,
                list_id=lst.id,
                status_id=st(lst, status_name).id,
                reporter_id=reporter.id,
                assignee_ids=[u.id for u in (assignees or [])],
                title=title,
                description=description,
                priority=priority,
                due_date=d(due) if due is not None else None,
                start_date=d(start) if start is not None else None,
                story_points=story_points,
                order_index=float(num),
                depth=0,
                path=task_path(tid),
                epic_id=epic.id if epic else None,
                task_number=num,
                task_key=key,
            )
            return t

        # ------------------------------------------------------------------
        # Web App — Q1 Sprint
        # ------------------------------------------------------------------
        t_login = make_task(
            "Implement Google OAuth login flow", proj_web, list_web_q1,
            "In Progress", dev, [dev, alice], Priority.high,
            due=7, start=-3, story_points=5, epic=epic_auth,
            description="Set up authlib, callback handler, JWT issuance, and frontend redirect.",
        )
        t_signup = make_task(
            "Email/password signup with verification", proj_web, list_web_q1,
            "Backlog", alice, [bob], Priority.medium,
            due=21, story_points=3, epic=epic_auth,
        )
        t_sso = make_task(
            "SAML 2.0 SSO integration for enterprise plans", proj_web, list_web_q1,
            "Backlog", dev, [], Priority.low,
            due=60, story_points=8, epic=epic_auth,
        )
        t_onboard = make_task(
            "User onboarding wizard (4-step)", proj_web, list_web_q1,
            "In Review", carol, [carol, alice], Priority.high,
            due=5, start=-7, story_points=5,
            description="Steps: workspace name → invite teammates → create first project → tour.",
        )
        t_settings = make_task(
            "Profile & notification settings page", proj_web, list_web_q1,
            "Done", bob, [bob], Priority.medium,
            due=-2, start=-14, story_points=3,
        )
        t_dark_mode = make_task(
            "Dark mode support (CSS variables + toggle)", proj_web, list_web_q1,
            "Backlog", alice, [carol], Priority.low,
            due=45, story_points=2,
        )

        # Web App — Q2 Sprint
        t_dash_widgets = make_task(
            "Configurable dashboard widgets", proj_web, list_web_q2,
            "Backlog", dev, [dev, bob], Priority.high,
            due=30, story_points=8, epic=epic_dashboard,
        )
        t_dash_charts = make_task(
            "Task completion trend chart", proj_web, list_web_q2,
            "Backlog", alice, [alice], Priority.medium,
            due=40, story_points=5, epic=epic_dashboard,
        )
        t_dash_csv = make_task(
            "Export dashboard data as CSV/PDF", proj_web, list_web_q2,
            "Backlog", bob, [bob], Priority.low,
            due=55, story_points=3, epic=epic_dashboard,
        )
        t_notif_bell = make_task(
            "Notification bell & inbox panel", proj_web, list_web_q2,
            "In Progress", carol, [carol, dave], Priority.medium,
            due=14, start=-1, story_points=5,
        )
        t_keyboard = make_task(
            "Global keyboard shortcuts (⌘K command palette)", proj_web, list_web_q2,
            "Backlog", dave, [dave], Priority.low,
            due=50, story_points=5,
        )

        # Web App — Bug Tracker
        t_bug_login_loop = make_task(
            "Fix: OAuth redirect loop on Safari", proj_web, list_web_bugs,
            "In Progress", dev, [dev], Priority.urgent,
            due=1, story_points=2,
            description="Users on Safari 17 hit an infinite redirect after Google callback. "
                        "Likely SameSite cookie issue.",
        )
        t_bug_notif_dup = make_task(
            "Fix: Duplicate @mention notifications", proj_web, list_web_bugs,
            "Backlog", bob, [bob], Priority.high,
            due=5, story_points=1,
        )
        t_bug_scroll = make_task(
            "Fix: Board view horizontal scroll broken on mobile", proj_web, list_web_bugs,
            "Backlog", carol, [carol], Priority.medium,
            due=10, story_points=1,
        )
        t_bug_timezone = make_task(
            "Fix: Due-date shown as day-1 in UTC-5 timezones", proj_web, list_web_bugs,
            "In Review", alice, [alice, dev], Priority.high,
            due=3, story_points=1,
        )

        # ------------------------------------------------------------------
        # Backend API — Core Services
        # ------------------------------------------------------------------
        t_rate_limit = make_task(
            "Add rate limiting (100 req/min per IP)", proj_api, list_api_core,
            "In Progress", dev, [dev], Priority.high,
            due=7, start=-2, story_points=3, epic=epic_perf,
            description="Use Redis sliding window. Apply to auth endpoints first, then global.",
        )
        t_pagination = make_task(
            "Standardise cursor-based pagination across all list endpoints", proj_api, list_api_core,
            "Backlog", bob, [bob, dave], Priority.medium,
            due=21, story_points=5, epic=epic_perf,
        )
        t_search_index = make_task(
            "Add pg_trgm GIN indexes on searchable columns", proj_api, list_api_core,
            "Done", dev, [dev], Priority.medium,
            due=-5, start=-14, story_points=2, epic=epic_perf,
        )
        t_audit_retention = make_task(
            "Audit log retention policy (purge > 1 year)", proj_api, list_api_core,
            "Backlog", alice, [alice], Priority.low,
            due=60, story_points=2,
        )
        t_webhook_retry = make_task(
            "Webhook delivery — exponential backoff retry", proj_api, list_api_core,
            "Backlog", dave, [dave], Priority.medium,
            due=30, story_points=3,
        )
        t_api_docs = make_task(
            "Publish OpenAPI docs to /docs with auth", proj_api, list_api_core,
            "In Review", bob, [bob], Priority.low,
            due=14, story_points=2,
        )

        # Backend API — Infrastructure
        t_db_migrate = make_task(
            "Zero-downtime migration strategy for Alembic", proj_api, list_api_infra,
            "Backlog", dev, [dev], Priority.high,
            due=20, story_points=5,
        )
        t_redis_cluster = make_task(
            "Redis Cluster setup for Pub/Sub at scale", proj_api, list_api_infra,
            "Backlog", dave, [dave], Priority.medium,
            due=45, story_points=8,
        )
        t_sentry = make_task(
            "Integrate Sentry error tracking", proj_api, list_api_infra,
            "Done", dev, [dev], Priority.medium,
            due=-10, start=-20, story_points=2,
        )
        t_ci_pipeline = make_task(
            "GitHub Actions CI: lint + test + build on PR", proj_api, list_api_infra,
            "In Progress", alice, [alice, bob], Priority.high,
            due=7, start=-5, story_points=3,
        )

        # ------------------------------------------------------------------
        # Mobile App — v1.0
        # ------------------------------------------------------------------
        t_mob_auth = make_task(
            "Mobile OAuth login (Google + Apple)", proj_mobile, list_mob_v1,
            "In Progress", bob, [bob, carol], Priority.urgent,
            due=10, start=-3, story_points=5, epic=epic_mobile_launch,
        )
        t_mob_push = make_task(
            "Push notification setup (FCM + APNs)", proj_mobile, list_mob_v1,
            "Backlog", dave, [dave], Priority.high,
            due=20, story_points=5, epic=epic_mobile_launch,
        )
        t_mob_offline = make_task(
            "Offline mode — queue mutations and sync on reconnect", proj_mobile, list_mob_v1,
            "Backlog", bob, [bob], Priority.medium,
            due=35, story_points=8, epic=epic_mobile_launch,
        )
        t_mob_deeplink = make_task(
            "Deep link handling for task/notification URLs", proj_mobile, list_mob_v1,
            "Backlog", carol, [carol], Priority.medium,
            due=25, story_points=3, epic=epic_mobile_launch,
        )
        t_mob_a11y = make_task(
            "Accessibility audit — VoiceOver & TalkBack", proj_mobile, list_mob_v1,
            "Backlog", alice, [alice, carol], Priority.low,
            due=40, story_points=3, epic=epic_mobile_launch,
        )

        # Mobile App — v2.0 Roadmap
        t_mob_widgets = make_task(
            "Home-screen widget (today's tasks)", proj_mobile, list_mob_v2,
            "Backlog", carol, [], Priority.low,
            due=90, story_points=5,
        )
        t_mob_watch = make_task(
            "Apple Watch companion app", proj_mobile, list_mob_v2,
            "Backlog", dave, [], Priority.none,
            due=120, story_points=13,
        )

        all_tasks = [
            t_login, t_signup, t_sso, t_onboard, t_settings, t_dark_mode,
            t_dash_widgets, t_dash_charts, t_dash_csv, t_notif_bell, t_keyboard,
            t_bug_login_loop, t_bug_notif_dup, t_bug_scroll, t_bug_timezone,
            t_rate_limit, t_pagination, t_search_index, t_audit_retention,
            t_webhook_retry, t_api_docs,
            t_db_migrate, t_redis_cluster, t_sentry, t_ci_pipeline,
            t_mob_auth, t_mob_push, t_mob_offline, t_mob_deeplink, t_mob_a11y,
            t_mob_widgets, t_mob_watch,
        ]
        s.add_all(all_tasks)
        await s.flush()

        # Update project next_task_number counters
        for proj in [proj_web, proj_api, proj_mobile]:
            proj.next_task_number = task_counters[str(proj.id)]
        await s.flush()

        # ── Subtasks ───────────────────────────────────────────────────────
        def make_subtask(
            title: str,
            parent: Task,
            status_name: str,
            assignees: list[User] | None = None,
            priority: Priority = Priority.medium,
            due: int | None = None,
        ) -> Task:
            # Subtask belongs to same project/list as parent
            proj = next(p for p in [proj_web, proj_api, proj_mobile] if p.id == parent.project_id)
            lst  = next(l for l in all_lists if l.id == parent.list_id)
            num, key = next_key(proj)
            tid = uuid4()
            t = Task(
                id=tid,
                workspace_id=ws.id,
                project_id=parent.project_id,
                list_id=parent.list_id,
                parent_task_id=parent.id,
                status_id=st(lst, status_name).id,
                reporter_id=parent.reporter_id,
                assignee_ids=[u.id for u in (assignees or [])],
                title=title,
                priority=priority,
                due_date=d(due) if due is not None else None,
                order_index=float(num),
                depth=1,
                path=task_path(tid, str(parent.path)),
                epic_id=parent.epic_id,
                task_number=num,
                task_key=key,
            )
            return t

        sub_oauth_callback = make_subtask(
            "Handle /auth/callback route & token exchange",
            t_login, "Done", [dev], Priority.high, due=-2,
        )
        sub_oauth_frontend = make_subtask(
            "Frontend redirect after successful login",
            t_login, "In Progress", [alice], Priority.high, due=3,
        )
        sub_oauth_refresh = make_subtask(
            "Silent token refresh (rotate on expiry)",
            t_login, "Backlog", [dev], Priority.medium, due=10,
        )

        sub_onboard_step1 = make_subtask(
            "Step 1: workspace name input + slug preview",
            t_onboard, "Done", [carol], Priority.medium,
        )
        sub_onboard_step2 = make_subtask(
            "Step 2: invite teammates by email",
            t_onboard, "Done", [carol], Priority.medium,
        )
        sub_onboard_step3 = make_subtask(
            "Step 3: create first project",
            t_onboard, "In Review", [alice], Priority.medium, due=4,
        )

        sub_widget_chart = make_subtask(
            "Line chart component (recharts)", t_dash_widgets, "Backlog", [dev], Priority.medium, due=32,
        )
        sub_widget_drag = make_subtask(
            "Drag-to-reorder widget grid", t_dash_widgets, "Backlog", [bob], Priority.medium, due=35,
        )

        sub_rate_ip = make_subtask(
            "Per-IP rate limit middleware", t_rate_limit, "In Progress", [dev], Priority.high, due=5,
        )
        sub_rate_user = make_subtask(
            "Per-user rate limit for authenticated routes", t_rate_limit, "Backlog", [dev], Priority.medium, due=9,
        )

        all_subtasks = [
            sub_oauth_callback, sub_oauth_frontend, sub_oauth_refresh,
            sub_onboard_step1, sub_onboard_step2, sub_onboard_step3,
            sub_widget_chart, sub_widget_drag,
            sub_rate_ip, sub_rate_user,
        ]
        s.add_all(all_subtasks)
        await s.flush()

        # Update project counters again after subtasks
        for proj in [proj_web, proj_api, proj_mobile]:
            proj.next_task_number = task_counters[str(proj.id)]
        await s.flush()

        # ── Task Dependencies ──────────────────────────────────────────────
        deps = [
            TaskDependency(task_id=t_signup.id,     depends_on_id=t_login.id),      # signup blocked by login infra
            TaskDependency(task_id=t_sso.id,        depends_on_id=t_signup.id),     # SSO blocked by email signup
            TaskDependency(task_id=t_dash_widgets.id, depends_on_id=t_onboard.id),  # dashboard after onboarding
            TaskDependency(task_id=t_dash_charts.id,  depends_on_id=t_dash_widgets.id),
            TaskDependency(task_id=t_dash_csv.id,     depends_on_id=t_dash_charts.id),
            TaskDependency(task_id=t_pagination.id,   depends_on_id=t_search_index.id),
            TaskDependency(task_id=t_mob_push.id,     depends_on_id=t_mob_auth.id),
            TaskDependency(task_id=t_mob_deeplink.id, depends_on_id=t_mob_auth.id),
        ]
        s.add_all(deps)
        await s.flush()

        # ── Tags on tasks ──────────────────────────────────────────────────
        task_tag_pairs = [
            (t_bug_login_loop, tag_bug),   (t_bug_login_loop, tag_security),
            (t_bug_notif_dup, tag_bug),
            (t_bug_scroll, tag_bug),       (t_bug_scroll, tag_ux),
            (t_bug_timezone, tag_bug),
            (t_login, tag_feature),        (t_login, tag_security),
            (t_sso, tag_feature),          (t_sso, tag_security),
            (t_signup, tag_feature),
            (t_onboard, tag_feature),      (t_onboard, tag_ux),
            (t_dark_mode, tag_ux),
            (t_dash_widgets, tag_feature),
            (t_dash_charts, tag_feature),  (t_dash_charts, tag_ux),
            (t_dash_csv, tag_feature),     (t_dash_csv, tag_docs),
            (t_notif_bell, tag_feature),   (t_notif_bell, tag_ux),
            (t_keyboard, tag_ux),          (t_keyboard, tag_feature),
            (t_rate_limit, tag_perf),      (t_rate_limit, tag_security),
            (t_pagination, tag_perf),      (t_pagination, tag_tech_debt),
            (t_search_index, tag_perf),
            (t_webhook_retry, tag_tech_debt),
            (t_api_docs, tag_docs),
            (t_db_migrate, tag_tech_debt), (t_db_migrate, tag_perf),
            (t_redis_cluster, tag_perf),
            (t_sentry, tag_tech_debt),
            (t_ci_pipeline, tag_tech_debt),
            (t_mob_auth, tag_feature),     (t_mob_auth, tag_security),
            (t_mob_push, tag_feature),
            (t_mob_offline, tag_feature),  (t_mob_offline, tag_perf),
            (t_mob_a11y, tag_ux),
        ]
        s.add_all([TaskTag(task_id=task.id, tag_id=tag.id) for task, tag in task_tag_pairs])
        await s.flush()

        # ── Comments ──────────────────────────────────────────────────────
        comments = [
            Comment(task_id=t_login.id, author_id=alice.id,
                    body="I've reviewed the authlib docs — we should use the async client, "
                         "not the sync wrapper. Also need to handle the `state` param to prevent CSRF."),
            Comment(task_id=t_login.id, author_id=dev.id,
                    body=f"Good catch @alice. I'll add `secrets.token_urlsafe(32)` to the session. "
                         "Assigning sub-task for the callback route now.",
                    mentions=[alice.id]),
            Comment(task_id=t_login.id, author_id=bob.id,
                    body="Do we need to handle token revocation on logout? "
                         "Or just clear the cookie client-side for v1?"),

            Comment(task_id=t_bug_login_loop.id, author_id=dev.id,
                    body="Reproduced on Safari 17.3. The `SameSite=Lax` cookie is being "
                         "dropped on the cross-origin callback. Switching to `SameSite=None; Secure` should fix it."),
            Comment(task_id=t_bug_login_loop.id, author_id=alice.id,
                    body="Make sure to test on iOS Safari too — it has different cookie behavior in WKWebView."),

            Comment(task_id=t_onboard.id, author_id=carol.id,
                    body="Step 2 (invite teammates) is done and in review. "
                         "Waiting on designs for the empty-state illustration @alice.",
                    mentions=[alice.id]),
            Comment(task_id=t_onboard.id, author_id=alice.id,
                    body="Illustration is ready, sending Figma link. "
                         "Should we use the animated SVG version or static PNG?"),
            Comment(task_id=t_onboard.id, author_id=carol.id,
                    body="Let's go static PNG for now to keep bundle size down. "
                         "We can animate it in Phase 2."),

            Comment(task_id=t_rate_limit.id, author_id=dave.id,
                    body="Redis sliding window is the right call. "
                         "Just make sure the key TTL equals the window size to avoid memory leaks."),
            Comment(task_id=t_rate_limit.id, author_id=dev.id,
                    body="Will do. I'm using `EXPIRE window_key 60` after each ZADD. "
                         "Per-user limits come in the next sub-task."),

            Comment(task_id=t_ci_pipeline.id, author_id=alice.id,
                    body="First draft is up — runs pytest and ruff on every PR. "
                         "Build step TBD once Docker push creds are sorted."),
            Comment(task_id=t_ci_pipeline.id, author_id=bob.id,
                    body="LGTM on the pytest step. "
                         "Should we add a branch protection rule to require CI passing before merge?"),
            Comment(task_id=t_ci_pipeline.id, author_id=alice.id,
                    body="Yes — I've added the branch protection rule to main. "
                         "Admins can still merge without review in emergencies."),

            Comment(task_id=t_mob_auth.id, author_id=bob.id,
                    body="Apple sign-in requires a `nonce` in the ID token — "
                         "authlib handles this automatically if you set `nonce=True`."),
            Comment(task_id=t_mob_auth.id, author_id=carol.id,
                    body="Google OAuth on Android also needs the SHA-1 fingerprint registered "
                         "in Firebase — @dave can you add the dev & prod fingerprints?",
                    mentions=[dave.id]),
        ]
        s.add_all(comments)
        await s.flush()

        # ── Commit everything ──────────────────────────────────────────────
        await s.commit()

        # ── Print summary ──────────────────────────────────────────────────
        token = create_access_token(dev.id)

        print("\n✅  Seed complete!\n")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("  Dev account")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"  Email        : dev@issuehub.app")
        print(f"  Display name : Dev (You)")
        print(f"  Role         : Workspace owner")
        print()
        print("  To get a fresh token (expires in 15 min):")
        print("  POST /api/v1/dev/token?email=dev@issuehub.app")
        print()
        print(f"  One-time token: {token}")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print()
        print("  Other accounts (same endpoint, swap email):")
        print("  alice@issuehub.app  — Admin")
        print("  bob@issuehub.app    — Member (Engineering team)")
        print("  carol@issuehub.app  — Member (Design team)")
        print("  dave@issuehub.app   — Member (Engineering team)")
        print()
        print("  Workspace  : Acme Corp")
        print("  Projects   : Web App (WEB-*), Backend API (API-*), Mobile App (MOB-*)")
        print(f"  Tasks      : {len(all_tasks)} root tasks, {len(all_subtasks)} subtasks")
        print(f"  Tags       : bug, feature, ux, perf, security, tech-debt, docs")
        print(f"  Epics      : Authentication & SSO, Analytics Dashboard,")
        print(f"               Performance Hardening, v1.0 Launch Checklist")
        print()


if __name__ == "__main__":
    asyncio.run(seed())

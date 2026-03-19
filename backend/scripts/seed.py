"""
Seed the development database with realistic dummy data.

Usage (from repo root):
    docker compose exec backend python scripts/seed.py

The script is idempotent: if dev@issuehub.app already exists it exits early.
To re-seed from scratch, wipe first:
    docker compose exec backend python scripts/seed.py --reset

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
    return NOW + timedelta(days=days)


def task_path(task_id, parent_path: str | None = None) -> Ltree:
    node = str(task_id).replace("-", "_")
    if parent_path:
        return Ltree(f"{parent_path}.{node}")
    return Ltree(node)


# ---------------------------------------------------------------------------
# Reset helper
# ---------------------------------------------------------------------------

async def reset_db(s):
    """Truncate all application tables in dependency order."""
    tables = [
        # leaf / junction tables first
        "task_tags", "task_dependencies", "task_links", "task_watchers",
        "task_git_links", "task_approvals", "time_entries",
        "attachments", "notifications",
        "comments", "audit_logs",
        "custom_field_values", "custom_field_definitions",
        "automations", "saved_views",
        "status_mappings", "list_statuses", "list_templates",
        "dashboard_widgets", "description_templates",
        "tasks", "epics", "lists", "projects",
        "team_members", "teams",
        "workspace_invites", "workspace_members", "workspaces",
        "tags", "users",
    ]
    for t in tables:
        await s.execute(text(f'TRUNCATE TABLE "{t}" RESTART IDENTITY CASCADE'))
    await s.commit()
    print("✓ Database wiped.")


# ---------------------------------------------------------------------------
# Main seed
# ---------------------------------------------------------------------------


async def seed(force_reset: bool = False):
    async with AsyncSessionFactory() as s:

        # ── Guard / reset ──────────────────────────────────────────────────
        existing = (
            await s.execute(select(User).where(User.email == "dev@issuehub.app"))
        ).scalar_one_or_none()

        if existing and not force_reset:
            print("✓ Database already seeded — skipping.")
            token = create_access_token(existing.id)
            print(f"\nDev token (expires in 15 min): {token}")
            return

        if force_reset:
            await reset_db(s)

        print("Seeding …")

        # ── Users ──────────────────────────────────────────────────────────
        dev   = User(email="dev@issuehub.app",   display_name="Dev (You)")
        alice = User(email="alice@issuehub.app", display_name="Alice Chen")
        bob   = User(email="bob@issuehub.app",   display_name="Bob Tanaka")
        carol = User(email="carol@issuehub.app", display_name="Carol Reyes")
        dave  = User(email="dave@issuehub.app",  display_name="Dave Kim")
        s.add_all([dev, alice, bob, carol, dave])
        await s.flush()

        # ── Workspace ──────────────────────────────────────────────────────
        ws = Workspace(name="Acme Corp")
        s.add(ws)
        await s.flush()

        for user, role in [
            (dev,   WorkspaceRole.owner),
            (alice, WorkspaceRole.admin),
            (bob,   WorkspaceRole.member),
            (carol, WorkspaceRole.member),
            (dave,  WorkspaceRole.member),
        ]:
            s.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role=role))
        await s.flush()

        # ── Teams ──────────────────────────────────────────────────────────
        eng_team    = Team(workspace_id=ws.id, name="Engineering", created_by=dev.id)
        design_team = Team(workspace_id=ws.id, name="Design",      created_by=alice.id)
        s.add_all([eng_team, design_team])
        await s.flush()

        s.add_all([
            TeamMember(team_id=eng_team.id,    user_id=dev.id,   role=TeamRole.team_admin),
            TeamMember(team_id=eng_team.id,    user_id=bob.id,   role=TeamRole.team_member),
            TeamMember(team_id=eng_team.id,    user_id=dave.id,  role=TeamRole.team_member),
            TeamMember(team_id=design_team.id, user_id=alice.id, role=TeamRole.team_admin),
            TeamMember(team_id=design_team.id, user_id=carol.id, role=TeamRole.team_member),
        ])
        await s.flush()

        # ── Tags ───────────────────────────────────────────────────────────
        tag_bug       = Tag(workspace_id=ws.id, name="bug",       color="#ef4444")
        tag_feature   = Tag(workspace_id=ws.id, name="feature",   color="#3b82f6")
        tag_ux        = Tag(workspace_id=ws.id, name="ux",        color="#a855f7")
        tag_perf      = Tag(workspace_id=ws.id, name="perf",      color="#f59e0b")
        tag_security  = Tag(workspace_id=ws.id, name="security",  color="#dc2626")
        tag_tech_debt = Tag(workspace_id=ws.id, name="tech-debt", color="#6b7280")
        tag_docs      = Tag(workspace_id=ws.id, name="docs",      color="#10b981")
        s.add_all([tag_bug, tag_feature, tag_ux, tag_perf, tag_security, tag_tech_debt, tag_docs])
        await s.flush()

        # ── Projects ───────────────────────────────────────────────────────
        #
        # Club  — community / club management platform
        # Book  — digital bookstore & reading tracker
        # Ism   — opinion & debate publishing platform
        #
        proj_club = Project(
            workspace_id=ws.id,
            name="Club",
            description="Community and club management — members, events, dues",
            task_prefix="CLB",
            next_task_number=1,
        )
        proj_book = Project(
            workspace_id=ws.id,
            name="Book",
            description="Digital bookstore and personal reading tracker",
            task_prefix="BOK",
            next_task_number=1,
        )
        proj_ism = Project(
            workspace_id=ws.id,
            name="Ism",
            description="Opinion and debate publishing platform",
            task_prefix="ISM",
            next_task_number=1,
        )
        s.add_all([proj_club, proj_book, proj_ism])
        await s.flush()

        # ── Lists (Backend / Frontend / App / UI / DevOps per project) ───────
        def make_statuses(list_id) -> list[ListStatus]:
            return [
                ListStatus(list_id=list_id, name="Backlog",     color="#6b7280", order_index=0.0, category=StatusCategory.not_started),
                ListStatus(list_id=list_id, name="In Progress", color="#3b82f6", order_index=1.0, category=StatusCategory.active),
                ListStatus(list_id=list_id, name="In Review",   color="#f59e0b", order_index=2.0, category=StatusCategory.active),
                ListStatus(list_id=list_id, name="Done",        color="#22c55e", order_index=3.0, category=StatusCategory.done, is_complete=True),
                ListStatus(list_id=list_id, name="Cancelled",   color="#ef4444", order_index=4.0, category=StatusCategory.cancelled),
            ]

        # Club
        list_club_be     = List(project_id=proj_club.id, name="Backend")
        list_club_fe     = List(project_id=proj_club.id, name="Frontend")
        list_club_app    = List(project_id=proj_club.id, name="App")
        list_club_ui     = List(project_id=proj_club.id, name="UI")
        list_club_devops = List(project_id=proj_club.id, name="DevOps")

        # Book
        list_book_be     = List(project_id=proj_book.id, name="Backend")
        list_book_fe     = List(project_id=proj_book.id, name="Frontend")
        list_book_app    = List(project_id=proj_book.id, name="App")
        list_book_ui     = List(project_id=proj_book.id, name="UI")
        list_book_devops = List(project_id=proj_book.id, name="DevOps")

        # Ism
        list_ism_be     = List(project_id=proj_ism.id, name="Backend")
        list_ism_fe     = List(project_id=proj_ism.id, name="Frontend")
        list_ism_app    = List(project_id=proj_ism.id, name="App")
        list_ism_ui     = List(project_id=proj_ism.id, name="UI")
        list_ism_devops = List(project_id=proj_ism.id, name="DevOps")

        all_lists = [
            list_club_be, list_club_fe, list_club_app, list_club_ui, list_club_devops,
            list_book_be, list_book_fe, list_book_app, list_book_ui, list_book_devops,
            list_ism_be,  list_ism_fe,  list_ism_app,  list_ism_ui,  list_ism_devops,
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
        # Club epics
        epic_club_member = Epic(
            project_id=proj_club.id, workspace_id=ws.id,
            name="Member Portal", color="#6366f1",
            status=EpicStatus.in_progress,
            start_date=d(-20), due_date=d(25),
            order_index=1.0, created_by=dev.id,
            description="Self-service portal for members to view profile, pay dues, RSVP events.",
        )
        epic_club_events = Epic(
            project_id=proj_club.id, workspace_id=ws.id,
            name="Event Management", color="#f59e0b",
            status=EpicStatus.not_started,
            start_date=d(10), due_date=d(55),
            order_index=2.0, created_by=alice.id,
            description="Admin tools to create/manage events, sell tickets, track attendance.",
        )

        # Book epics
        epic_book_catalog = Epic(
            project_id=proj_book.id, workspace_id=ws.id,
            name="Catalog & Discovery", color="#10b981",
            status=EpicStatus.in_progress,
            start_date=d(-10), due_date=d(30),
            order_index=1.0, created_by=bob.id,
            description="Search, browse, and ISBN-lookup for the book catalog.",
        )
        epic_book_reading = Epic(
            project_id=proj_book.id, workspace_id=ws.id,
            name="Reading Tracker", color="#8b5cf6",
            status=EpicStatus.not_started,
            start_date=d(15), due_date=d(60),
            order_index=2.0, created_by=carol.id,
            description="Track reading progress, shelves, goals, and stats per user.",
        )

        # Ism epics
        epic_ism_feed = Epic(
            project_id=proj_ism.id, workspace_id=ws.id,
            name="Core Feed", color="#ef4444",
            status=EpicStatus.in_progress,
            start_date=d(-15), due_date=d(20),
            order_index=1.0, created_by=dev.id,
            description="Personalised feed of articles ranked by recency, votes, and follows.",
        )
        epic_ism_debate = Epic(
            project_id=proj_ism.id, workspace_id=ws.id,
            name="Debate Engine", color="#f97316",
            status=EpicStatus.not_started,
            start_date=d(5), due_date=d(50),
            order_index=2.0, created_by=alice.id,
            description="Structured pro/con debate threads with voting and moderation.",
        )

        s.add_all([
            epic_club_member, epic_club_events,
            epic_book_catalog, epic_book_reading,
            epic_ism_feed, epic_ism_debate,
        ])
        await s.flush()

        # ── Task factory ───────────────────────────────────────────────────
        task_counters: dict[str, int] = {
            str(proj_club.id): 1,
            str(proj_book.id): 1,
            str(proj_ism.id):  1,
        }

        def next_key(proj: Project) -> tuple[int, str]:
            n = task_counters[str(proj.id)]
            task_counters[str(proj.id)] += 1
            return n, f"{proj.task_prefix}-{n:05d}"

        def make_task(
            title: str,
            proj: Project,
            lst: List,
            status_name: str,
            reporter: User,
            assignees: list[User] | None = None,
            priority: Priority = Priority.medium,
            due: int | None = None,
            start: int | None = None,
            story_points: int | None = None,
            epic: Epic | None = None,
            description: str | None = None,
        ) -> Task:
            num, key = next_key(proj)
            tid = uuid4()
            return Task(
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

        # ==================================================================
        # CLUB — Backend
        # ==================================================================
        t_club_member_api = make_task(
            "Member registration & profile API",
            proj_club, list_club_be, "In Progress",
            dev, [dev], Priority.high,
            due=10, start=-5, story_points=5, epic=epic_club_member,
            description="POST /members, GET /members/{id}, PATCH profile fields. "
                        "Store avatar in S3, return signed URL.",
        )
        t_club_roles = make_task(
            "Role-based access control (admin / member / guest)",
            proj_club, list_club_be, "In Progress",
            dev, [dev, bob], Priority.high,
            due=8, start=-3, story_points=3, epic=epic_club_member,
        )
        t_club_dues_api = make_task(
            "Dues payment API — Stripe integration",
            proj_club, list_club_be, "Backlog",
            bob, [bob], Priority.medium,
            due=30, story_points=8, epic=epic_club_member,
            description="Webhook handler for payment.succeeded / failed. "
                        "Store payment records, update member status.",
        )
        t_club_event_api = make_task(
            "Event CRUD endpoints",
            proj_club, list_club_be, "Backlog",
            dave, [dave], Priority.medium,
            due=20, story_points=5, epic=epic_club_events,
        )
        t_club_rsvp_api = make_task(
            "RSVP / attendance tracking endpoint",
            proj_club, list_club_be, "Backlog",
            dave, [dave, dev], Priority.medium,
            due=28, story_points=3, epic=epic_club_events,
        )
        t_club_invite_api = make_task(
            "Email invite system — token-based onboarding",
            proj_club, list_club_be, "Done",
            dev, [dev], Priority.high,
            due=-3, start=-18, story_points=3, epic=epic_club_member,
        )
        t_club_bug_dupe_invite = make_task(
            "Fix: duplicate invite emails sent on retry",
            proj_club, list_club_be, "In Review",
            bob, [bob], Priority.urgent,
            due=2, story_points=1,
        )

        # ==================================================================
        # CLUB — Frontend
        # ==================================================================
        t_club_member_dir = make_task(
            "Member directory page with search & filter",
            proj_club, list_club_fe, "In Progress",
            alice, [carol, alice], Priority.high,
            due=12, start=-2, story_points=5, epic=epic_club_member,
        )
        t_club_profile_page = make_task(
            "Member profile & edit form",
            proj_club, list_club_fe, "Backlog",
            carol, [carol], Priority.medium,
            due=18, story_points=3, epic=epic_club_member,
        )
        t_club_dues_ui = make_task(
            "Dues payment flow (Stripe Elements)",
            proj_club, list_club_fe, "Backlog",
            alice, [alice], Priority.medium,
            due=35, story_points=5, epic=epic_club_member,
        )
        t_club_event_calendar = make_task(
            "Event calendar view (month + list toggle)",
            proj_club, list_club_fe, "Backlog",
            carol, [carol, alice], Priority.medium,
            due=25, story_points=5, epic=epic_club_events,
        )
        t_club_admin_panel = make_task(
            "Admin panel — manage members & roles",
            proj_club, list_club_fe, "Backlog",
            dev, [dev, carol], Priority.low,
            due=40, story_points=8, epic=epic_club_member,
        )
        t_club_bug_mobile_nav = make_task(
            "Fix: sidebar nav hidden on tablet (< 1024px)",
            proj_club, list_club_fe, "Backlog",
            carol, [carol], Priority.medium,
            due=7, story_points=1,
        )

        # ==================================================================
        # CLUB — App
        # ==================================================================
        t_club_checkin = make_task(
            "QR-code check-in screen for events",
            proj_club, list_club_app, "Backlog",
            bob, [bob], Priority.high,
            due=22, story_points=5, epic=epic_club_events,
        )
        t_club_push_events = make_task(
            "Push notifications for upcoming events",
            proj_club, list_club_app, "Backlog",
            dave, [dave], Priority.medium,
            due=30, story_points=3, epic=epic_club_events,
        )
        t_club_member_card = make_task(
            "Digital membership card with QR code",
            proj_club, list_club_app, "In Progress",
            bob, [bob, carol], Priority.high,
            due=15, start=-1, story_points=3, epic=epic_club_member,
        )

        # ==================================================================
        # BOOK — Backend
        # ==================================================================
        t_book_catalog_api = make_task(
            "Book catalog API — CRUD + ISBN lookup (Open Library)",
            proj_book, list_book_be, "In Progress",
            dev, [dev], Priority.high,
            due=8, start=-4, story_points=5, epic=epic_book_catalog,
            description="GET /books?q=, GET /books/{isbn}. "
                        "Proxy Open Library API, cache results in Redis for 24 h.",
        )
        t_book_search = make_task(
            "Full-text search with pg_trgm (title, author, genre)",
            proj_book, list_book_be, "In Progress",
            bob, [bob], Priority.high,
            due=10, start=-2, story_points=3, epic=epic_book_catalog,
        )
        t_book_review_api = make_task(
            "Review & star-rating endpoints",
            proj_book, list_book_be, "Backlog",
            dave, [dave], Priority.medium,
            due=22, story_points=3, epic=epic_book_catalog,
        )
        t_book_shelf_api = make_task(
            "Reading shelf API (want / reading / finished)",
            proj_book, list_book_be, "Backlog",
            dev, [dev, bob], Priority.medium,
            due=25, story_points=5, epic=epic_book_reading,
        )
        t_book_progress_api = make_task(
            "Reading progress tracking (page / % / notes)",
            proj_book, list_book_be, "Backlog",
            bob, [bob], Priority.medium,
            due=35, story_points=5, epic=epic_book_reading,
        )
        t_book_recommend = make_task(
            "Recommendation engine — collaborative filtering (v1)",
            proj_book, list_book_be, "Backlog",
            dave, [dave], Priority.low,
            due=60, story_points=13, epic=epic_book_catalog,
        )
        t_book_bug_isbn = make_task(
            "Fix: ISBN-13 lookup returns 404 for valid Kindle editions",
            proj_book, list_book_be, "In Review",
            dev, [dev], Priority.urgent,
            due=2, story_points=1,
        )

        # ==================================================================
        # BOOK — Frontend
        # ==================================================================
        t_book_browse = make_task(
            "Book browse page — grid + filters (genre, rating, year)",
            proj_book, list_book_fe, "In Progress",
            alice, [alice, carol], Priority.high,
            due=12, start=-3, story_points=5, epic=epic_book_catalog,
        )
        t_book_detail = make_task(
            "Book detail page — synopsis, reviews, buy / borrow CTAs",
            proj_book, list_book_fe, "Backlog",
            carol, [carol], Priority.medium,
            due=18, story_points=5, epic=epic_book_catalog,
        )
        t_book_shelf_ui = make_task(
            "My Bookshelf UI — tabbed shelves with progress rings",
            proj_book, list_book_fe, "Backlog",
            alice, [alice], Priority.medium,
            due=30, story_points=8, epic=epic_book_reading,
        )
        t_book_stats = make_task(
            "Reading stats dashboard (books/year, pages/day chart)",
            proj_book, list_book_fe, "Backlog",
            carol, [carol, alice], Priority.low,
            due=45, story_points=5, epic=epic_book_reading,
        )
        t_book_bug_cover = make_task(
            "Fix: book cover images overflow card on Safari iOS",
            proj_book, list_book_fe, "Backlog",
            carol, [carol], Priority.medium,
            due=5, story_points=1,
        )

        # ==================================================================
        # BOOK — App
        # ==================================================================
        t_book_barcode = make_task(
            "Barcode scanner — scan ISBN to add book",
            proj_book, list_book_app, "In Progress",
            bob, [bob], Priority.high,
            due=14, start=-2, story_points=5, epic=epic_book_catalog,
        )
        t_book_offline = make_task(
            "Offline reading list sync (SQLite + background sync)",
            proj_book, list_book_app, "Backlog",
            dave, [dave], Priority.medium,
            due=40, story_points=8, epic=epic_book_reading,
        )
        t_book_reminder = make_task(
            "Daily reading reminder push notification",
            proj_book, list_book_app, "Backlog",
            bob, [bob, carol], Priority.low,
            due=35, story_points=3, epic=epic_book_reading,
        )

        # ==================================================================
        # ISM — Backend
        # ==================================================================
        t_ism_post_api = make_task(
            "Article / post CRUD API",
            proj_ism, list_ism_be, "Done",
            dev, [dev], Priority.high,
            due=-5, start=-20, story_points=5, epic=epic_ism_feed,
        )
        t_ism_feed_api = make_task(
            "Personalised feed endpoint — ranking algorithm v1",
            proj_ism, list_ism_be, "In Progress",
            dev, [dev, bob], Priority.high,
            due=8, start=-5, story_points=8, epic=epic_ism_feed,
            description="Score = recency_weight * age_decay + vote_weight * net_votes "
                        "+ follow_weight * (author in following). Paginated cursor.",
        )
        t_ism_vote_api = make_task(
            "Vote / reaction system (upvote, downvote, bookmark)",
            proj_ism, list_ism_be, "In Progress",
            bob, [bob], Priority.medium,
            due=10, start=-2, story_points=3, epic=epic_ism_feed,
        )
        t_ism_comment_api = make_task(
            "Threaded comment API with nested replies",
            proj_ism, list_ism_be, "Backlog",
            dave, [dave], Priority.medium,
            due=20, story_points=5, epic=epic_ism_debate,
        )
        t_ism_debate_api = make_task(
            "Debate thread API — pro/con sides, voting per argument",
            proj_ism, list_ism_be, "Backlog",
            dev, [dev, dave], Priority.medium,
            due=30, story_points=8, epic=epic_ism_debate,
        )
        t_ism_moderation = make_task(
            "Moderation queue API — flag, hide, ban",
            proj_ism, list_ism_be, "Backlog",
            bob, [bob], Priority.high,
            due=25, story_points=5, epic=epic_ism_debate,
        )
        t_ism_bug_feed_dup = make_task(
            "Fix: duplicate articles appear in feed after vote",
            proj_ism, list_ism_be, "In Review",
            dev, [dev], Priority.urgent,
            due=1, story_points=2,
        )

        # ==================================================================
        # ISM — Frontend
        # ==================================================================
        t_ism_feed_page = make_task(
            "Feed / timeline page with infinite scroll",
            proj_ism, list_ism_fe, "In Progress",
            alice, [alice, carol], Priority.high,
            due=10, start=-4, story_points=5, epic=epic_ism_feed,
        )
        t_ism_editor = make_task(
            "Article editor — rich text (TipTap) with image upload",
            proj_ism, list_ism_fe, "Backlog",
            carol, [carol], Priority.high,
            due=20, story_points=8, epic=epic_ism_feed,
        )
        t_ism_topic_browser = make_task(
            "Topic / tag browser with trending count",
            proj_ism, list_ism_fe, "Backlog",
            alice, [alice], Priority.medium,
            due=28, story_points=3, epic=epic_ism_feed,
        )
        t_ism_debate_ui = make_task(
            "Debate page — pro/con columns with live vote tally",
            proj_ism, list_ism_fe, "Backlog",
            carol, [carol, alice], Priority.medium,
            due=38, story_points=8, epic=epic_ism_debate,
        )
        t_ism_profile = make_task(
            "Author profile page — bio, article list, follower count",
            proj_ism, list_ism_fe, "Backlog",
            alice, [alice], Priority.low,
            due=45, story_points=3, epic=epic_ism_feed,
        )
        t_ism_bug_editor_crash = make_task(
            "Fix: editor crashes on paste from Google Docs",
            proj_ism, list_ism_fe, "In Progress",
            carol, [carol], Priority.urgent,
            due=2, story_points=2,
        )

        # ==================================================================
        # ISM — App
        # ==================================================================
        t_ism_app_feed = make_task(
            "Mobile feed with pull-to-refresh and skeleton loaders",
            proj_ism, list_ism_app, "In Progress",
            bob, [bob, dave], Priority.high,
            due=12, start=-3, story_points=5, epic=epic_ism_feed,
        )
        t_ism_app_share = make_task(
            "Share sheet integration — share article to other apps",
            proj_ism, list_ism_app, "Backlog",
            dave, [dave], Priority.medium,
            due=25, story_points=3, epic=epic_ism_feed,
        )
        t_ism_app_notif = make_task(
            "Notification digest — daily top articles push",
            proj_ism, list_ism_app, "Backlog",
            bob, [bob], Priority.low,
            due=40, story_points=3, epic=epic_ism_feed,
        )

        # ==================================================================
        # CLUB — UI
        # ==================================================================
        t_club_ui_ds = make_task(
            "Design system — colour tokens, type scale, spacing",
            proj_club, list_club_ui, "Done",
            alice, [alice], Priority.high,
            due=-10, start=-30, story_points=5,
            description="Establish Tailwind theme tokens used across all Club screens.",
        )
        t_club_ui_components = make_task(
            "Component library — Button, Input, Modal, Badge",
            proj_club, list_club_ui, "In Progress",
            alice, [alice, carol], Priority.high,
            due=8, start=-5, story_points=8, epic=epic_club_member,
        )
        t_club_ui_icons = make_task(
            "Icon set — replace emoji with SVG icon system",
            proj_club, list_club_ui, "In Review",
            carol, [carol], Priority.medium,
            due=4, story_points=3,
        )
        t_club_ui_event_card = make_task(
            "Event card component — thumbnail, date chip, RSVP button",
            proj_club, list_club_ui, "Backlog",
            carol, [carol, alice], Priority.medium,
            due=22, story_points=3, epic=epic_club_events,
        )
        t_club_ui_empty_states = make_task(
            "Empty state illustrations — no events, no members",
            proj_club, list_club_ui, "Backlog",
            alice, [alice], Priority.low,
            due=30, story_points=2, epic=epic_club_member,
        )

        # ==================================================================
        # CLUB — DevOps
        # ==================================================================
        t_club_devops_ci = make_task(
            "GitHub Actions CI — lint, test, build on every PR",
            proj_club, list_club_devops, "Done",
            dev, [dev], Priority.high,
            due=-8, start=-18, story_points=3,
        )
        t_club_devops_docker = make_task(
            "Dockerise backend + frontend with multi-stage build",
            proj_club, list_club_devops, "In Progress",
            dave, [dave, dev], Priority.high,
            due=7, start=-2, story_points=5,
            description="Base image: python:3.12-slim. Frontend built in Node stage, "
                        "static files served via Caddy sidecar.",
        )
        t_club_devops_env = make_task(
            "Environment config — staging vs production .env strategy",
            proj_club, list_club_devops, "Backlog",
            dev, [dev], Priority.medium,
            due=15, story_points=2,
        )
        t_club_devops_db_backup = make_task(
            "Automated daily Postgres backups to S3",
            proj_club, list_club_devops, "Backlog",
            dave, [dave], Priority.high,
            due=20, story_points=3,
        )
        t_club_devops_monitor = make_task(
            "Uptime monitoring + Sentry error tracking",
            proj_club, list_club_devops, "Backlog",
            dev, [dev], Priority.medium,
            due=25, story_points=2,
        )

        # ==================================================================
        # BOOK — UI
        # ==================================================================
        t_book_ui_ds = make_task(
            "Design system — warm neutral palette, serif type scale",
            proj_book, list_book_ui, "Done",
            alice, [alice], Priority.high,
            due=-12, start=-28, story_points=5,
        )
        t_book_ui_cover_card = make_task(
            "Book cover card — hover zoom, rating stars, shelf badge",
            proj_book, list_book_ui, "In Progress",
            carol, [carol, alice], Priority.high,
            due=6, start=-3, story_points=5, epic=epic_book_catalog,
        )
        t_book_ui_progress_ring = make_task(
            "Reading progress ring component (SVG, animated)",
            proj_book, list_book_ui, "Backlog",
            alice, [alice], Priority.medium,
            due=20, story_points=3, epic=epic_book_reading,
        )
        t_book_ui_review_form = make_task(
            "Star-rating + review form with character counter",
            proj_book, list_book_ui, "Backlog",
            carol, [carol], Priority.medium,
            due=25, story_points=3, epic=epic_book_catalog,
        )
        t_book_ui_dark_mode = make_task(
            "Dark mode — sepia/night toggle for comfortable reading",
            proj_book, list_book_ui, "Backlog",
            alice, [alice, carol], Priority.low,
            due=45, story_points=3,
        )

        # ==================================================================
        # BOOK — DevOps
        # ==================================================================
        t_book_devops_ci = make_task(
            "CI pipeline — pytest + ruff + type-check on PR",
            proj_book, list_book_devops, "Done",
            dev, [dev], Priority.high,
            due=-6, start=-16, story_points=3,
        )
        t_book_devops_cdn = make_task(
            "CDN setup — serve book cover images via CloudFront",
            proj_book, list_book_devops, "In Progress",
            dave, [dave], Priority.high,
            due=10, start=-1, story_points=5,
            description="Invalidation strategy: key by ISBN + size suffix. "
                        "Lambda@Edge for on-the-fly resizing.",
        )
        t_book_devops_redis = make_task(
            "Redis cluster — HA setup for catalog cache",
            proj_book, list_book_devops, "Backlog",
            dave, [dave, dev], Priority.medium,
            due=30, story_points=5,
        )
        t_book_devops_db_index = make_task(
            "Production DB index audit — slow query report",
            proj_book, list_book_devops, "Backlog",
            bob, [bob], Priority.medium,
            due=20, story_points=2,
        )
        t_book_devops_deploy = make_task(
            "Zero-downtime deploy with rolling restart + health check",
            proj_book, list_book_devops, "Backlog",
            dev, [dev, dave], Priority.high,
            due=35, story_points=5,
        )

        # ==================================================================
        # ISM — UI
        # ==================================================================
        t_ism_ui_ds = make_task(
            "Design system — bold editorial type, high-contrast tokens",
            proj_ism, list_ism_ui, "Done",
            alice, [alice], Priority.high,
            due=-14, start=-30, story_points=5,
        )
        t_ism_ui_article_card = make_task(
            "Article card — headline, author chip, vote bar, topic tag",
            proj_ism, list_ism_ui, "In Progress",
            carol, [carol, alice], Priority.high,
            due=8, start=-2, story_points=5, epic=epic_ism_feed,
        )
        t_ism_ui_debate_layout = make_task(
            "Debate layout — split pro/con columns with sticky vote bar",
            proj_ism, list_ism_ui, "Backlog",
            alice, [alice, carol], Priority.medium,
            due=25, story_points=8, epic=epic_ism_debate,
        )
        t_ism_ui_vote_animation = make_task(
            "Vote button micro-animation — spring scale + colour shift",
            proj_ism, list_ism_ui, "Backlog",
            carol, [carol], Priority.low,
            due=35, story_points=2, epic=epic_ism_feed,
        )
        t_ism_ui_a11y = make_task(
            "Accessibility audit — WCAG 2.1 AA compliance pass",
            proj_ism, list_ism_ui, "Backlog",
            alice, [alice, carol], Priority.medium,
            due=40, story_points=5,
        )

        # ==================================================================
        # ISM — DevOps
        # ==================================================================
        t_ism_devops_ci = make_task(
            "CI — lint + test + Docker build gate on PR",
            proj_ism, list_ism_devops, "Done",
            dev, [dev], Priority.high,
            due=-7, start=-17, story_points=3,
        )
        t_ism_devops_k8s = make_task(
            "Kubernetes deployment — Helm chart for API + worker",
            proj_ism, list_ism_devops, "In Progress",
            dave, [dave, dev], Priority.high,
            due=14, start=-3, story_points=8,
            description="Separate Deployments for API (3 replicas) and feed-worker (2 replicas). "
                        "HPA on CPU > 70%.",
        )
        t_ism_devops_cdn = make_task(
            "CDN + image optimisation pipeline for article images",
            proj_ism, list_ism_devops, "Backlog",
            dave, [dave], Priority.medium,
            due=28, story_points=5,
        )
        t_ism_devops_logging = make_task(
            "Centralised logging — structured JSON logs → OpenSearch",
            proj_ism, list_ism_devops, "Backlog",
            bob, [bob, dave], Priority.medium,
            due=32, story_points=5,
        )
        t_ism_devops_secrets = make_task(
            "Secrets management — migrate env vars to Vault / AWS SSM",
            proj_ism, list_ism_devops, "Backlog",
            dev, [dev], Priority.high,
            due=22, story_points=3,
        )

        # ── Cross-list feature tasks ───────────────────────────────────────
        #
        # These parent tasks live in the Backend list (the blocking layer).
        # Their subtasks are spread across Backend, Frontend, App, and UI lists
        # because each discipline owns a distinct piece of the same feature.
        #
        # Rationale: the feature task anchors in Backend because nothing else
        # can start until the API contract is settled. The parent's completion
        # is gated on ALL subtasks finishing, regardless of which list they live in.
        #

        # Club — "Event check-in flow" (parent in Backend; subs in BE / FE / App / UI)
        t_club_checkin_flow = make_task(
            "Event check-in flow — end-to-end",
            proj_club, list_club_be, "In Progress",
            dev, [dev], Priority.high,
            due=18, start=-1, story_points=13, epic=epic_club_events,
            description="Full check-in experience: QR token generation (backend), "
                        "attendee management page (frontend), QR scanner screen (app), "
                        "and success/error states (UI). "
                        "Parent lives in Backend — the API contract must be finalised "
                        "before any other list can start their piece.",
        )

        # Book — "Borrow / reserve a book" (parent in Backend; subs in BE / FE / App)
        t_book_borrow_flow = make_task(
            "Borrow / reserve a book — end-to-end",
            proj_book, list_book_be, "Backlog",
            bob, [bob], Priority.high,
            due=35, story_points=13, epic=epic_book_catalog,
            description="Reserve API + hold queue (backend), reservation UI + confirmation "
                        "page (frontend), one-tap reserve from barcode scan (app). "
                        "Parent lives in Backend as the API drives all other pieces.",
        )

        all_tasks = [
            # Club
            t_club_member_api, t_club_roles, t_club_dues_api, t_club_event_api,
            t_club_rsvp_api, t_club_invite_api, t_club_bug_dupe_invite,
            t_club_member_dir, t_club_profile_page, t_club_dues_ui,
            t_club_event_calendar, t_club_admin_panel, t_club_bug_mobile_nav,
            t_club_checkin, t_club_push_events, t_club_member_card,
            t_club_ui_ds, t_club_ui_components, t_club_ui_icons,
            t_club_ui_event_card, t_club_ui_empty_states,
            t_club_devops_ci, t_club_devops_docker, t_club_devops_env,
            t_club_devops_db_backup, t_club_devops_monitor,
            # Book
            t_book_catalog_api, t_book_search, t_book_review_api,
            t_book_shelf_api, t_book_progress_api, t_book_recommend,
            t_book_bug_isbn,
            t_book_browse, t_book_detail, t_book_shelf_ui, t_book_stats,
            t_book_bug_cover,
            t_book_barcode, t_book_offline, t_book_reminder,
            t_book_ui_ds, t_book_ui_cover_card, t_book_ui_progress_ring,
            t_book_ui_review_form, t_book_ui_dark_mode,
            t_book_devops_ci, t_book_devops_cdn, t_book_devops_redis,
            t_book_devops_db_index, t_book_devops_deploy,
            # Ism
            t_ism_post_api, t_ism_feed_api, t_ism_vote_api,
            t_ism_comment_api, t_ism_debate_api, t_ism_moderation,
            t_ism_bug_feed_dup,
            t_ism_feed_page, t_ism_editor, t_ism_topic_browser,
            t_ism_debate_ui, t_ism_profile, t_ism_bug_editor_crash,
            t_ism_app_feed, t_ism_app_share, t_ism_app_notif,
            t_ism_ui_ds, t_ism_ui_article_card, t_ism_ui_debate_layout,
            t_ism_ui_vote_animation, t_ism_ui_a11y,
            t_ism_devops_ci, t_ism_devops_k8s, t_ism_devops_cdn,
            t_ism_devops_logging, t_ism_devops_secrets,
            # Cross-list feature tasks (parent in Backend; subtasks span multiple lists)
            t_club_checkin_flow, t_book_borrow_flow,
        ]
        s.add_all(all_tasks)
        await s.flush()

        for proj in [proj_club, proj_book, proj_ism]:
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
            list_override: List | None = None,  # place subtask in a different list than parent
        ) -> Task:
            proj = next(p for p in [proj_club, proj_book, proj_ism] if p.id == parent.project_id)
            lst  = list_override if list_override else next(l for l in all_lists if l.id == parent.list_id)
            num, key = next_key(proj)
            tid = uuid4()
            return Task(
                id=tid,
                workspace_id=ws.id,
                project_id=parent.project_id,
                list_id=lst.id,
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

        # Club subtasks
        sub_club_member_model   = make_subtask("Define Member DB model + migration",         t_club_member_api, "Done",        [dev],          Priority.high,   due=-4)
        sub_club_member_s3      = make_subtask("S3 avatar upload + signed URL helper",       t_club_member_api, "In Progress", [dev],          Priority.medium, due=8)
        sub_club_roles_policy   = make_subtask("Write RBAC policy decorator for FastAPI",    t_club_roles,      "In Progress", [dev],          Priority.high,   due=6)
        sub_club_roles_tests    = make_subtask("Unit tests for role enforcement",            t_club_roles,      "Backlog",     [bob],          Priority.medium, due=10)
        sub_club_event_model    = make_subtask("Event + Ticket DB schema",                   t_club_event_api,  "Backlog",     [dave],         Priority.medium, due=18)
        sub_club_event_notif    = make_subtask("Trigger email on event publish",             t_club_event_api,  "Backlog",     [dave],         Priority.low,    due=22)

        # Book subtasks
        sub_book_isbn_cache     = make_subtask("Redis cache layer for Open Library calls",   t_book_catalog_api, "In Progress", [dev],         Priority.high,   due=6)
        sub_book_isbn_normalize = make_subtask("Normalise ISBN-10 / ISBN-13 input",          t_book_catalog_api, "Done",        [dev],         Priority.medium, due=-2)
        sub_book_search_index   = make_subtask("GIN index on books.title + authors",         t_book_search,     "Done",        [bob],          Priority.high,   due=-1)
        sub_book_search_weight  = make_subtask("Weighted ts_rank (title > author > genre)",  t_book_search,     "In Progress", [bob],          Priority.medium, due=8)

        # Club — cross-list subtasks for "Event check-in flow"
        sub_checkin_api   = make_subtask(
            "QR token generation + POST /events/{id}/checkin endpoint",
            t_club_checkin_flow, "In Progress", [dev], Priority.high, due=10,
            # stays in Backend (parent's list — the API layer)
        )
        sub_checkin_fe    = make_subtask(
            "Check-in management page — attendee list + manual override",
            t_club_checkin_flow, "Backlog", [carol], Priority.high, due=14,
            list_override=list_club_fe,   # lives in Frontend
        )
        sub_checkin_app   = make_subtask(
            "QR scanner screen — camera permission + decode + confirm toast",
            t_club_checkin_flow, "Backlog", [bob], Priority.high, due=16,
            list_override=list_club_app,  # lives in App
        )
        sub_checkin_ui    = make_subtask(
            "Check-in success / failure states — animations + error copy",
            t_club_checkin_flow, "Backlog", [alice], Priority.medium, due=17,
            list_override=list_club_ui,   # lives in UI
        )

        # Book — cross-list subtasks for "Borrow / reserve a book"
        sub_borrow_api    = make_subtask(
            "POST /books/{id}/reserve + availability check + hold queue",
            t_book_borrow_flow, "Backlog", [bob], Priority.high, due=28,
            # stays in Backend
        )
        sub_borrow_fe     = make_subtask(
            "Reserve button + confirmation modal on book detail page",
            t_book_borrow_flow, "Backlog", [carol], Priority.high, due=30,
            list_override=list_book_fe,   # lives in Frontend
        )
        sub_borrow_app    = make_subtask(
            "One-tap reserve from barcode scan result screen",
            t_book_borrow_flow, "Backlog", [dave], Priority.medium, due=32,
            list_override=list_book_app,  # lives in App
        )

        # Ism subtasks
        sub_ism_feed_score      = make_subtask("Implement scoring function + unit tests",    t_ism_feed_api,    "In Progress", [dev],          Priority.high,   due=5)
        sub_ism_feed_cache      = make_subtask("Cache top-50 feed per user in Redis (5 min)",t_ism_feed_api,    "Backlog",     [bob],          Priority.medium, due=10)
        sub_ism_vote_dedup      = make_subtask("Prevent double-vote with unique constraint", t_ism_vote_api,    "Done",        [bob],          Priority.high,   due=-1)
        sub_ism_vote_undo       = make_subtask("Allow vote retraction within 60 s",          t_ism_vote_api,    "In Progress", [bob],          Priority.medium, due=8)

        all_subtasks = [
            sub_club_member_model, sub_club_member_s3,  # noqa: F821 — defined above
            sub_club_roles_policy, sub_club_roles_tests,
            sub_club_event_model, sub_club_event_notif,
            # cross-list: Club check-in flow (BE → FE → App → UI)
            sub_checkin_api, sub_checkin_fe, sub_checkin_app, sub_checkin_ui,
            sub_book_isbn_cache, sub_book_isbn_normalize,
            sub_book_search_index, sub_book_search_weight,
            # cross-list: Book borrow flow (BE → FE → App)
            sub_borrow_api, sub_borrow_fe, sub_borrow_app,
            sub_ism_feed_score, sub_ism_feed_cache,
            sub_ism_vote_dedup, sub_ism_vote_undo,
        ]
        s.add_all(all_subtasks)
        await s.flush()

        for proj in [proj_club, proj_book, proj_ism]:
            proj.next_task_number = task_counters[str(proj.id)]
        await s.flush()

        # ── Task Dependencies ──────────────────────────────────────────────
        deps = [
            # Club: dues UI needs dues API; RSVP needs event API
            TaskDependency(task_id=t_club_dues_ui.id,      depends_on_id=t_club_dues_api.id),
            TaskDependency(task_id=t_club_rsvp_api.id,     depends_on_id=t_club_event_api.id),
            TaskDependency(task_id=t_club_checkin.id,      depends_on_id=t_club_rsvp_api.id),
            TaskDependency(task_id=t_club_push_events.id,  depends_on_id=t_club_event_api.id),
            # Book: shelf UI needs shelf API; stats needs progress API
            TaskDependency(task_id=t_book_shelf_ui.id,     depends_on_id=t_book_shelf_api.id),
            TaskDependency(task_id=t_book_stats.id,        depends_on_id=t_book_progress_api.id),
            TaskDependency(task_id=t_book_offline.id,      depends_on_id=t_book_shelf_api.id),
            TaskDependency(task_id=t_book_recommend.id,    depends_on_id=t_book_review_api.id),
            # Ism: debate UI needs debate API; moderation needs comment + post APIs
            TaskDependency(task_id=t_ism_debate_ui.id,     depends_on_id=t_ism_debate_api.id),
            TaskDependency(task_id=t_ism_debate_api.id,    depends_on_id=t_ism_comment_api.id),
            TaskDependency(task_id=t_ism_moderation.id,    depends_on_id=t_ism_post_api.id),
            TaskDependency(task_id=t_ism_editor.id,        depends_on_id=t_ism_post_api.id),
        ]
        s.add_all(deps)
        await s.flush()

        # ── Tags on tasks ──────────────────────────────────────────────────
        task_tag_pairs = [
            # Club
            (t_club_roles,          tag_security),
            (t_club_dues_api,       tag_feature),  (t_club_dues_api,       tag_security),
            (t_club_invite_api,     tag_feature),
            (t_club_bug_dupe_invite,tag_bug),
            (t_club_member_api,     tag_feature),
            (t_club_member_dir,     tag_feature),  (t_club_member_dir,     tag_ux),
            (t_club_dues_ui,        tag_ux),
            (t_club_event_calendar, tag_ux),       (t_club_event_calendar, tag_feature),
            (t_club_bug_mobile_nav, tag_bug),      (t_club_bug_mobile_nav, tag_ux),
            (t_club_checkin,        tag_feature),
            # Book
            (t_book_catalog_api,    tag_feature),
            (t_book_search,         tag_perf),     (t_book_search,         tag_feature),
            (t_book_recommend,      tag_feature),  (t_book_recommend,      tag_perf),
            (t_book_bug_isbn,       tag_bug),
            (t_book_browse,         tag_feature),  (t_book_browse,         tag_ux),
            (t_book_shelf_ui,       tag_ux),       (t_book_shelf_ui,       tag_feature),
            (t_book_stats,          tag_feature),
            (t_book_bug_cover,      tag_bug),      (t_book_bug_cover,      tag_ux),
            (t_book_barcode,        tag_feature),
            (t_book_offline,        tag_perf),     (t_book_offline,        tag_tech_debt),
            # Ism
            (t_ism_feed_api,        tag_perf),     (t_ism_feed_api,        tag_feature),
            (t_ism_vote_api,        tag_feature),
            (t_ism_debate_api,      tag_feature),
            (t_ism_moderation,      tag_security), (t_ism_moderation,      tag_feature),
            (t_ism_bug_feed_dup,    tag_bug),      (t_ism_bug_feed_dup,    tag_perf),
            (t_ism_feed_page,       tag_ux),       (t_ism_feed_page,       tag_feature),
            (t_ism_editor,          tag_ux),       (t_ism_editor,          tag_feature),
            (t_ism_debate_ui,       tag_ux),       (t_ism_debate_ui,       tag_feature),
            (t_ism_bug_editor_crash,tag_bug),
            (t_ism_app_feed,        tag_perf),     (t_ism_app_feed,        tag_ux),
            # Club UI / DevOps
            (t_club_ui_components,  tag_ux),       (t_club_ui_components,  tag_feature),
            (t_club_ui_icons,       tag_ux),       (t_club_ui_icons,       tag_tech_debt),
            (t_club_ui_event_card,  tag_ux),       (t_club_ui_event_card,  tag_feature),
            (t_club_devops_docker,  tag_tech_debt),
            (t_club_devops_db_backup, tag_security),
            # Book UI / DevOps
            (t_book_ui_cover_card,  tag_ux),       (t_book_ui_cover_card,  tag_feature),
            (t_book_ui_progress_ring, tag_ux),
            (t_book_ui_dark_mode,   tag_ux),
            (t_book_devops_cdn,     tag_perf),
            (t_book_devops_redis,   tag_perf),     (t_book_devops_redis,   tag_tech_debt),
            (t_book_devops_deploy,  tag_tech_debt),
            # Ism UI / DevOps
            (t_ism_ui_article_card, tag_ux),       (t_ism_ui_article_card, tag_feature),
            (t_ism_ui_debate_layout,tag_ux),       (t_ism_ui_debate_layout,tag_feature),
            (t_ism_ui_vote_animation, tag_ux),
            (t_ism_ui_a11y,         tag_ux),
            (t_ism_devops_k8s,      tag_perf),     (t_ism_devops_k8s,      tag_tech_debt),
            (t_ism_devops_logging,  tag_tech_debt),
            (t_ism_devops_secrets,  tag_security),
        ]
        s.add_all([TaskTag(task_id=task.id, tag_id=tag.id) for task, tag in task_tag_pairs])
        await s.flush()

        # ── Comments ──────────────────────────────────────────────────────
        comments = [
            # Club
            Comment(task_id=t_club_member_api.id, author_id=alice.id,
                    body="Should we allow members to set a custom slug for their profile URL? "
                         "e.g. `/members/alice-chen` vs `/members/{uuid}`"),
            Comment(task_id=t_club_member_api.id, author_id=dev.id,
                    body=f"Good idea — let's add an optional `slug` column, unique index, "
                         "auto-generated from display name. @alice can you add that to the API spec?",
                    mentions=[alice.id]),
            Comment(task_id=t_club_bug_dupe_invite.id, author_id=bob.id,
                    body="Root cause: the retry job didn't check `invite.sent_at` before re-sending. "
                         "Fix is a simple null-check before dispatch."),
            Comment(task_id=t_club_bug_dupe_invite.id, author_id=dev.id,
                    body="Also add an idempotency key to the email send call so the provider "
                         "dedupes on their side as a safety net."),
            Comment(task_id=t_club_dues_api.id, author_id=dave.id,
                    body="Stripe recommends storing `payment_intent_id` and using it for "
                         "idempotent retries. Don't charge again if intent already succeeded."),

            # Book
            Comment(task_id=t_book_catalog_api.id, author_id=bob.id,
                    body="Open Library rate-limits at 100 req/s per IP. "
                         "The Redis cache should keep us well under that for popular ISBNs."),
            Comment(task_id=t_book_catalog_api.id, author_id=dev.id,
                    body="Agreed. I'm setting TTL to 24 h for metadata and 7 days for cover images "
                         "since those almost never change."),
            Comment(task_id=t_book_bug_isbn.id, author_id=dev.id,
                    body="Kindle ASINs start with `B0` — they're not valid ISBNs. "
                         "We need to detect ASIN format and route to Amazon Product API instead."),
            Comment(task_id=t_book_search.id, author_id=bob.id,
                    body="ts_rank with weights `{0.1, 0.2, 0.4, 1.0}` gives D→A priority. "
                         "Title match should definitely be weight A."),
            Comment(task_id=t_book_browse.id, author_id=carol.id,
                    body="Figma designs are ready for the grid view. "
                         "Filter panel slides in from the left on mobile — @alice can you review?",
                    mentions=[alice.id]),
            Comment(task_id=t_book_browse.id, author_id=alice.id,
                    body="Reviewed — looks great. One note: the active filter pill needs a clear (×) button "
                         "that's at least 44×44px for touch targets."),

            # Ism
            Comment(task_id=t_ism_feed_api.id, author_id=bob.id,
                    body="For the decay function, logarithmic decay `1 / log(hours + 2)` "
                         "tends to work better than exponential for opinion content — "
                         "older but highly-voted pieces stay visible longer."),
            Comment(task_id=t_ism_feed_api.id, author_id=dev.id,
                    body="Good point. I'll make the decay constant configurable via an env var "
                         "so we can tune without a deploy."),
            Comment(task_id=t_ism_bug_feed_dup.id, author_id=dev.id,
                    body="Found it — the vote endpoint re-fetches the feed slice and the cursor "
                         "pagination overlaps by 1 item. Off-by-one in the `WHERE id > :cursor` clause."),
            Comment(task_id=t_ism_bug_editor_crash.id, author_id=carol.id,
                    body="TipTap's `clipboardTextSerializer` strips HTML but Google Docs paste "
                         "sends `text/html` with `<b>` tags. Need to add a pasteHTML extension "
                         "and sanitise with DOMPurify before insert."),
            Comment(task_id=t_ism_bug_editor_crash.id, author_id=alice.id,
                    body="DOMPurify is already in the bundle for the comment box — "
                         "we can reuse the same sanitiser config. @carol I'll send the snippet.",
                    mentions=[carol.id]),
            Comment(task_id=t_ism_moderation.id, author_id=bob.id,
                    body="We should soft-delete flagged content (set `hidden=true`) rather than "
                         "hard delete so moderators can review and restore if needed."),
        ]
        s.add_all(comments)
        await s.flush()

        # ── Commit ────────────────────────────────────────────────────────
        await s.commit()

        token = create_access_token(dev.id)
        root_count = len(all_tasks)
        sub_count  = len(all_subtasks)

        print("\n✅  Seed complete!\n")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("  Dev account")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("  Email        : dev@issuehub.app")
        print("  Display name : Dev (You)")
        print("  Role         : Workspace owner")
        print()
        print("  To get a fresh token (expires in 15 min):")
        print("  POST /api/v1/dev/token?email=dev@issuehub.app")
        print()
        print(f"  One-time token: {token}")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print()
        print("  Other accounts (swap email in the same endpoint):")
        print("  alice@issuehub.app  — Admin")
        print("  bob@issuehub.app    — Member (Engineering team)")
        print("  carol@issuehub.app  — Member (Design team)")
        print("  dave@issuehub.app   — Member (Engineering team)")
        print()
        print("  Workspace : Acme Corp")
        print()
        print("  Projects & lists:")
        print("  Club (CLB-00001…)  — Backend / Frontend / App / UI / DevOps")
        print("  Book (BOK-00001…)  — Backend / Frontend / App / UI / DevOps")
        print("  Ism  (ISM-00001…)  — Backend / Frontend / App / UI / DevOps")
        print()
        print(f"  Tasks : {root_count} root tasks, {sub_count} subtasks")
        print("          (incl. 2 cross-list feature tasks: CLB check-in flow, BOK borrow flow)")
        print("  Epics : Member Portal, Event Management,")
        print("          Catalog & Discovery, Reading Tracker,")
        print("          Core Feed, Debate Engine")
        print("  Tags  : bug, feature, ux, perf, security, tech-debt, docs")
        print()


if __name__ == "__main__":
    force = "--reset" in sys.argv
    asyncio.run(seed(force_reset=force))

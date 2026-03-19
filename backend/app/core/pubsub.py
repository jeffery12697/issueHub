import json
import logging
from datetime import datetime, timezone
from uuid import UUID
from app.core.redis import redis

logger = logging.getLogger(__name__)


async def publish(channel: str, event: str, task_id: UUID, actor_id: UUID, data: dict):
    payload = json.dumps({
        "event": event,
        "task_id": str(task_id),
        "actor_id": str(actor_id),
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    try:
        await redis.publish(channel, payload)
    except Exception as exc:
        logger.warning("pubsub publish failed (non-critical): %s", exc)


async def publish_task_event(task_id: UUID, actor_id: UUID, event: str, data: dict = {}):
    await publish(f"task:{task_id}", event, task_id, actor_id, data)


async def publish_list_event(list_id: UUID, task_id: UUID, actor_id: UUID, event: str, data: dict = {}):
    await publish(f"list:{list_id}", event, task_id, actor_id, data)


async def publish_user_event(user_id: UUID, task_id: UUID, actor_id: UUID, event: str, data: dict = {}):
    await publish(f"user:{user_id}", event, task_id, actor_id, data)

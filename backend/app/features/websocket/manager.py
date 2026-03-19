import asyncio
import json
from uuid import UUID
from fastapi import WebSocket
from app.core.redis import redis

# Maps channel -> set of websockets
_subscribers: dict[str, set[WebSocket]] = {}


async def connect(websocket: WebSocket, channel: str):
    await websocket.accept()
    _subscribers.setdefault(channel, set()).add(websocket)


def disconnect(websocket: WebSocket, channel: str):
    if channel in _subscribers:
        _subscribers[channel].discard(websocket)
        if not _subscribers[channel]:
            del _subscribers[channel]


async def broadcast_from_redis(channel: str, message: str):
    sockets = list(_subscribers.get(channel, set()))
    if not sockets:
        return
    dead = []
    for ws in sockets:
        try:
            await ws.send_text(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _subscribers[channel].discard(ws)


async def redis_listener():
    """Background task: subscribe to all task/list channels via psubscribe."""
    pubsub = redis.pubsub()
    try:
        await pubsub.psubscribe("task:*", "list:*", "user:*")
        async for message in pubsub.listen():
            if message["type"] == "pmessage":
                channel = message["channel"]
                data = message["data"]
                await broadcast_from_redis(channel, data)
    except asyncio.CancelledError:
        pass
    finally:
        try:
            await pubsub.aclose()
        except Exception:
            pass

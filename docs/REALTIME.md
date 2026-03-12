# Real-time Architecture

## Overview
Real-time updates use **WebSocket** on the frontend and **Redis Pub/Sub** as the message bus between FastAPI workers.

## Why Redis Pub/Sub
FastAPI runs as multiple Uvicorn workers (via Gunicorn). A WebSocket connection lands on one worker, but a task mutation may be processed by a different worker. Redis Pub/Sub bridges them.

## Flow
```
Client A mutates task
    → FastAPI worker 1 writes to PostgreSQL
    → worker 1 publishes JSON event to Redis channel `task:{task_id}`
    → worker 2 (holding Client B's WebSocket) receives event from Redis
    → worker 2 forwards event to Client B over WebSocket
```

## Redis Channels
| Channel | Published when |
|---------|---------------|
| `task:{task_id}` | Any field change, comment, attachment, status change on that task |
| `list:{list_id}` | Task created/moved/deleted/reordered within a list (for board refresh) |

## WebSocket Endpoints
```
WS /ws/tasks/{task_id}    # subscribe to a single task's activity feed
WS /ws/lists/{list_id}    # subscribe to list-level task changes (kanban board)
```

## Event Payload Shape
```json
{
  "event": "task.updated | task.comment_added | task.status_changed | ...",
  "task_id": "<uuid>",
  "actor_id": "<uuid>",
  "data": { ... },
  "timestamp": "2026-01-01T00:00:00Z"
}
```

## Implementation Notes
- Use `redis.asyncio` for async pub/sub
- Each FastAPI worker runs a background asyncio subscriber loop at startup
- On WebSocket connect: register client → subscribe to Redis channel
- On WebSocket disconnect: remove client → unsubscribe if no remaining clients on that channel
- This is horizontally scalable — add workers without a central WebSocket server

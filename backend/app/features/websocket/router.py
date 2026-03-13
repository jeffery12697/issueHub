from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from uuid import UUID
from app.features.websocket.manager import connect, disconnect

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/tasks/{task_id}")
async def task_ws(websocket: WebSocket, task_id: UUID):
    channel = f"task:{task_id}"
    await connect(websocket, channel)
    try:
        while True:
            await websocket.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        disconnect(websocket, channel)


@router.websocket("/ws/lists/{list_id}")
async def list_ws(websocket: WebSocket, list_id: UUID):
    channel = f"list:{list_id}"
    await connect(websocket, channel)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        disconnect(websocket, channel)

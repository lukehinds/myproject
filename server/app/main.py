import asyncio
import json
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from .models import Element, Peer, Scene
from .reconciliation import merge_elements
from .store import Connection, Room, RoomStore

ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-"
PEER_COLORS = ("#e03131", "#1971c2", "#2f9e44", "#f08c00", "#9c36b5", "#0c8599")
SEND_TIMEOUT_SECONDS = 1.0


def make_id() -> str:
    return "".join(secrets.choice(ID_ALPHABET) for _ in range(21))


def create_app(*, data_dir: Path | None = None, debounce_seconds: float = 1.0) -> FastAPI:
    store = RoomStore(data_dir=data_dir, debounce_seconds=debounce_seconds)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await store.close()

    app = FastAPI(lifespan=lifespan)
    app.state.room_store = store

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/rooms")
    async def create_room() -> dict[str, str]:
        room_id = make_id()
        await store.get(room_id, create=True)
        return {"roomId": room_id}

    @app.get("/api/rooms/{room_id}")
    async def get_room(room_id: str) -> dict[str, Any]:
        room = await store.get(room_id)
        if room is None:
            raise HTTPException(status_code=404, detail="Room not found")
        async with room.lock:
            return {
                "roomId": room.room_id,
                "scene": room.scene.model_dump(exclude_none=True),
                "users": [connection.peer.model_dump() for connection in room.connections.values()],
            }

    @app.put("/api/rooms/{room_id}/scene")
    async def put_scene(room_id: str, scene: Scene) -> dict[str, Any]:
        room = await store.get(room_id)
        if room is None:
            raise HTTPException(status_code=404, detail="Room not found")
        async with room.lock:
            merge_elements(room.scene.elements, scene.elements)
            room.scene.appState = scene.appState
            result = room.scene.model_dump(exclude_none=True)
        store.schedule_save(room)
        return {"ok": True, "scene": result}

    @app.websocket("/ws/rooms/{room_id}")
    async def room_socket(
        websocket: WebSocket,
        room_id: str,
        name: str = Query(default="Anonymous"),
    ) -> None:
        await websocket.accept()
        room = await store.get(room_id, create=True)
        assert room is not None
        user_id = make_id()
        display_name = name.strip() or "Anonymous"
        async with room.lock:
            color = PEER_COLORS[room.next_color_index % len(PEER_COLORS)]
            room.next_color_index += 1
            peer = Peer(userId=user_id, name=display_name, color=color)
            connection = Connection(websocket=websocket, peer=peer)
            room.connections[user_id] = connection
            users = [connection.peer.model_dump() for connection in room.connections.values()]
            scene = room.scene.model_dump(exclude_none=True)
        try:
            await asyncio.wait_for(
                websocket.send_json(
                    {
                        "type": "init",
                        "userId": user_id,
                        "roomId": room_id,
                        "scene": scene,
                        "users": users,
                    }
                ),
                timeout=SEND_TIMEOUT_SECONDS,
            )
            await connection.send_lock.acquire()
            try:
                async with room.lock:
                    if room.connections.get(user_id) is not connection:
                        return
                    connection.initialized = True
                    pending_frames = connection.pending_frames
                    connection.pending_frames = []
                    users = [current.peer.model_dump() for current in room.connections.values()]
                for pending_frame in pending_frames:
                    await asyncio.wait_for(
                        websocket.send_json(pending_frame), timeout=SEND_TIMEOUT_SECONDS
                    )
            finally:
                connection.send_lock.release()
            await broadcast(room, {"type": "presence", "users": users})
            while True:
                raw = await websocket.receive_text()
                try:
                    frame = json.loads(raw)
                except json.JSONDecodeError:
                    await send_error(websocket, "Frame must be valid JSON")
                    continue
                if not isinstance(frame, dict):
                    await send_error(websocket, "Frame must be a JSON object")
                    continue
                frame_type = frame.get("type")
                if frame_type == "elements":
                    await handle_elements(room, user_id, websocket, frame)
                elif frame_type == "pointer":
                    await handle_pointer(room, user_id, websocket, frame)
                elif frame_type == "ping":
                    await websocket.send_json({"type": "pong"})
                else:
                    await send_error(websocket, f"Unknown frame type: {frame_type!r}")
        except (TimeoutError, RuntimeError, WebSocketDisconnect):
            pass
        finally:
            async with room.lock:
                removed = room.connections.pop(user_id, None) is not None
                users = [connection.peer.model_dump() for connection in room.connections.values()]
            if removed:
                await broadcast(room, {"type": "presence", "users": users})

    return app


async def send_error(websocket: WebSocket, message: str) -> None:
    await websocket.send_json({"type": "error", "message": message})


async def broadcast(room: Room, frame: dict[str, Any], exclude: str | None = None) -> None:
    async with room.lock:
        recipients = [
            (user_id, connection)
            for user_id, connection in room.connections.items()
            if user_id != exclude and connection.initialized
        ]
        for user_id, connection in room.connections.items():
            if user_id != exclude and not connection.initialized:
                connection.pending_frames.append(frame)

    async def send(connection: Connection) -> bool:
        async def locked_send() -> None:
            async with connection.send_lock:
                await connection.websocket.send_json(frame)

        try:
            await asyncio.wait_for(locked_send(), timeout=SEND_TIMEOUT_SECONDS)
        except (TimeoutError, RuntimeError, WebSocketDisconnect):
            return False
        return True

    results = await asyncio.gather(*(send(connection) for _, connection in recipients))
    failed = [
        recipient for recipient, delivered in zip(recipients, results, strict=True) if not delivered
    ]
    if not failed:
        return

    async with room.lock:
        removed: list[Connection] = []
        for user_id, connection in failed:
            if room.connections.get(user_id) is connection:
                del room.connections[user_id]
                removed.append(connection)
        users = [connection.peer.model_dump() for connection in room.connections.values()]

    async def close(connection: Connection) -> None:
        try:
            await asyncio.wait_for(connection.websocket.close(code=1011), timeout=0.1)
        except (TimeoutError, RuntimeError, WebSocketDisconnect):
            pass

    await asyncio.gather(*(close(connection) for connection in removed))
    if removed:
        await broadcast(room, {"type": "presence", "users": users})


async def handle_elements(
    room: Room, user_id: str, websocket: WebSocket, frame: dict[str, Any]
) -> None:
    raw_elements = frame.get("elements")
    if not isinstance(raw_elements, list):
        await send_error(websocket, "elements must be an array")
        return
    valid: list[Element] = []
    errors = 0
    for raw_element in raw_elements:
        try:
            valid.append(Element.model_validate(raw_element))
        except ValidationError:
            errors += 1
    async with room.lock:
        winners = merge_elements(room.scene.elements, valid)
    if winners:
        room_store = websocket.app.state.room_store
        room_store.schedule_save(room)
        await broadcast(
            room,
            {
                "type": "elements",
                "elements": [element.model_dump(exclude_none=True) for element in winners],
            },
            exclude=user_id,
        )
    if errors:
        await send_error(websocket, f"Rejected {errors} malformed element(s)")


async def handle_pointer(
    room: Room, user_id: str, websocket: WebSocket, frame: dict[str, Any]
) -> None:
    x, y, selected_ids = frame.get("x"), frame.get("y"), frame.get("selectedIds")
    if (
        not isinstance(x, int | float)
        or isinstance(x, bool)
        or not isinstance(y, int | float)
        or isinstance(y, bool)
        or not isinstance(selected_ids, list)
        or not all(isinstance(item, str) for item in selected_ids)
    ):
        await send_error(websocket, "Invalid pointer frame")
        return
    await broadcast(
        room,
        {"type": "pointer", "userId": user_id, "x": x, "y": y, "selectedIds": selected_ids},
        exclude=user_id,
    )


app = create_app()

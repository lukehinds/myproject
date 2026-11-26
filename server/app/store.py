import asyncio
import json
import os
import secrets
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import WebSocket

from .models import Peer, Scene, empty_scene


@dataclass
class Connection:
    websocket: WebSocket
    peer: Peer
    initialized: bool = False
    pending_frames: list[dict[str, object]] = field(default_factory=list)
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)


@dataclass
class Room:
    room_id: str
    scene: Scene = field(default_factory=empty_scene)
    connections: dict[str, Connection] = field(default_factory=dict)
    next_color_index: int = 0
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    save_event: asyncio.Event = field(default_factory=asyncio.Event)
    save_generation: int = 0
    saved_generation: int = 0
    writer_task: asyncio.Task[None] | None = None
    closing: bool = False


class RoomStore:
    def __init__(self, data_dir: Path | None = None, debounce_seconds: float = 1.0) -> None:
        default_dir = Path(__file__).resolve().parents[1] / "data"
        self.data_dir = data_dir or Path(os.environ.get("WHITEBOARD_DATA_DIR", default_dir))
        self.rooms_dir = self.data_dir / "rooms"
        self.debounce_seconds = debounce_seconds
        self._rooms: dict[str, Room] = {}
        self._store_lock = asyncio.Lock()

    def _path(self, room_id: str) -> Path:
        return self.rooms_dir / f"{room_id}.json"

    async def get(self, room_id: str, *, create: bool = False) -> Room | None:
        if room_id in self._rooms:
            return self._rooms[room_id]
        async with self._store_lock:
            if room_id in self._rooms:
                return self._rooms[room_id]
            path = self._path(room_id)
            if path.is_file():
                try:
                    raw = await asyncio.to_thread(path.read_text, encoding="utf-8")
                    value = json.loads(raw)
                    migrated = self._add_missing_z_indexes(value)
                    scene = Scene.model_validate(value)
                except (OSError, ValueError):
                    return None
                room = Room(room_id=room_id, scene=scene)
                self._rooms[room_id] = room
                if migrated:
                    self.schedule_save(room)
                return room
            if not create:
                return None
            room = Room(room_id=room_id)
            self._rooms[room_id] = room
            self.schedule_save(room)
            return room

    @staticmethod
    def _add_missing_z_indexes(value: object) -> bool:
        if not isinstance(value, dict) or not isinstance(value.get("elements"), list):
            return False
        migrated = False
        for index, element in enumerate(value["elements"]):
            if isinstance(element, dict) and "zIndex" not in element:
                element["zIndex"] = index
                migrated = True
        return migrated

    def schedule_save(self, room: Room) -> None:
        room.save_generation += 1
        room.save_event.set()
        if room.writer_task is None or room.writer_task.done():
            room.writer_task = asyncio.create_task(self._writer(room))

    async def _writer(self, room: Room) -> None:
        while True:
            await room.save_event.wait()
            room.save_event.clear()

            while not room.closing:
                try:
                    await asyncio.wait_for(room.save_event.wait(), timeout=self.debounce_seconds)
                except TimeoutError:
                    break
                room.save_event.clear()

            if room.saved_generation < room.save_generation:
                generation = room.save_generation
                await self._write_snapshot(room)
                room.saved_generation = generation

            if room.saved_generation < room.save_generation:
                room.save_event.set()
            elif room.closing:
                return

    async def _write_snapshot(self, room: Room) -> None:
        async with room.lock:
            payload = room.scene.model_dump_json(exclude_none=True)
        await asyncio.to_thread(self._atomic_write, self._path(room.room_id), payload)

    def _atomic_write(self, path: Path, payload: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = path.with_name(f".{path.name}.{os.getpid()}.{secrets.token_hex(4)}.tmp")
        try:
            temp_path.write_text(payload, encoding="utf-8")
            os.replace(temp_path, path)
        finally:
            temp_path.unlink(missing_ok=True)

    async def close(self) -> None:
        tasks: list[asyncio.Task[None]] = []
        for room in self._rooms.values():
            room.closing = True
            room.save_event.set()
            if room.writer_task is None or room.writer_task.done():
                room.writer_task = asyncio.create_task(self._writer(room))
            tasks.append(room.writer_task)
        if tasks:
            await asyncio.gather(*tasks)

import asyncio
import threading
from collections.abc import Callable
from pathlib import Path
from typing import Any

from app.models import Element, Scene, empty_scene
from app.store import Room, RoomStore


def scene_with(raw_element: dict[str, Any]) -> Scene:
    scene = empty_scene()
    scene.elements = [Element.model_validate(raw_element)]
    return scene


async def test_superseded_in_flight_save_cannot_overwrite_newer_scene(
    tmp_path: Path,
    element: Callable[..., dict[str, Any]],
    monkeypatch: Any,
) -> None:
    store = RoomStore(data_dir=tmp_path, debounce_seconds=0)
    room = Room(room_id="race-room", scene=scene_with(element(x=1)))
    store._rooms[room.room_id] = room
    first_write_started = threading.Event()
    release_first_write = threading.Event()
    real_atomic_write = store._atomic_write
    write_count = 0

    def slow_first_write(path: Path, payload: str) -> None:
        nonlocal write_count
        write_count += 1
        if write_count == 1:
            first_write_started.set()
            assert release_first_write.wait(timeout=2)
        real_atomic_write(path, payload)

    monkeypatch.setattr(store, "_atomic_write", slow_first_write)
    store.schedule_save(room)
    assert await asyncio.to_thread(first_write_started.wait, 2)

    async with room.lock:
        room.scene = scene_with(element(version=2, x=2))
    store.schedule_save(room)
    release_first_write.set()
    await store.close()

    persisted = Scene.model_validate_json((tmp_path / "rooms" / "race-room.json").read_text())
    assert persisted.elements[0].x == 2
    assert write_count == 2

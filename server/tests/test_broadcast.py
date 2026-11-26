import asyncio
from typing import Any

from app import main
from app.main import broadcast
from app.models import Peer
from app.store import Connection, Room


class SlowSocket:
    async def send_json(self, frame: dict[str, Any]) -> None:
        await asyncio.Event().wait()

    async def close(self, code: int) -> None:
        return None


class RecordingSocket:
    def __init__(self) -> None:
        self.frames: list[dict[str, Any]] = []

    async def send_json(self, frame: dict[str, Any]) -> None:
        self.frames.append(frame)

    async def close(self, code: int) -> None:
        return None


async def test_slow_peer_does_not_stall_healthy_peer(monkeypatch: Any) -> None:
    room = Room(room_id="room")
    healthy = RecordingSocket()
    room.connections = {
        "slow": Connection(
            websocket=SlowSocket(),  # type: ignore[arg-type]
            peer=Peer(userId="slow", name="Slow", color="#000000"),
            initialized=True,
        ),
        "healthy": Connection(
            websocket=healthy,  # type: ignore[arg-type]
            peer=Peer(userId="healthy", name="Healthy", color="#ffffff"),
            initialized=True,
        ),
    }
    monkeypatch.setattr(main, "SEND_TIMEOUT_SECONDS", 0.01)
    frame = {"type": "presence", "users": []}

    await asyncio.wait_for(broadcast(room, frame), timeout=0.1)

    assert healthy.frames == [
        frame,
        {"type": "presence", "users": [room.connections["healthy"].peer.model_dump()]},
    ]
    assert list(room.connections) == ["healthy"]

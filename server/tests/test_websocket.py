from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.main import create_app


def receive_until(socket: Any, frame_type: str) -> dict[str, Any]:
    while True:
        frame = socket.receive_json()
        if frame["type"] == frame_type:
            return frame


def test_two_client_round_trip_and_protocol_resilience(
    tmp_path: Path,
    element: Callable[..., dict[str, Any]],
) -> None:
    with TestClient(create_app(data_dir=tmp_path)) as client:
        with client.websocket_connect("/ws/rooms/shared-room?name=Alice") as alice:
            alice_init = alice.receive_json()
            assert alice_init["type"] == "init"
            assert alice_init["users"][0]["name"] == "Alice"
            receive_until(alice, "presence")

            with client.websocket_connect("/ws/rooms/shared-room?name=Bob") as bob:
                bob_init = bob.receive_json()
                assert bob_init["type"] == "init"
                assert {user["name"] for user in bob_init["users"]} == {"Alice", "Bob"}
                assert len({user["color"] for user in bob_init["users"]}) == 2
                receive_until(bob, "presence")
                joined = receive_until(alice, "presence")
                assert len(joined["users"]) == 2

                alice.send_json({"type": "elements", "elements": [element()]})
                update = receive_until(bob, "elements")
                assert update["elements"] == [element()]

                alice.send_json({"type": "ping"})
                assert alice.receive_json() == {"type": "pong"}

                alice.send_json(
                    {
                        "type": "elements",
                        "elements": [
                            {"id": "broken"},
                            element(version=2, versionNonce=99, x=42),
                        ],
                    }
                )
                valid_sibling = receive_until(bob, "elements")
                assert valid_sibling["elements"][0]["x"] == 42
                error = receive_until(alice, "error")
                assert "1 malformed" in error["message"]

                alice.send_json(
                    {
                        "type": "elements",
                        "elements": [element(version=1, versionNonce=1, x=999)],
                    }
                )
                alice.send_json({"type": "ping"})
                assert alice.receive_json() == {"type": "pong"}
                bob.send_json({"type": "ping"})
                assert bob.receive_json() == {"type": "pong"}

                alice.send_json(
                    {"type": "pointer", "x": 12.5, "y": -3, "selectedIds": [element()["id"]]}
                )
                pointer = receive_until(bob, "pointer")
                assert pointer == {
                    "type": "pointer",
                    "userId": alice_init["userId"],
                    "x": 12.5,
                    "y": -3,
                    "selectedIds": [element()["id"]],
                }

                alice.send_json({"type": "future-frame"})
                unknown = receive_until(alice, "error")
                assert "Unknown frame type" in unknown["message"]
                alice.send_json({"type": "ping"})
                assert alice.receive_json() == {"type": "pong"}

            left = receive_until(alice, "presence")
            assert [user["name"] for user in left["users"]] == ["Alice"]


def test_connect_creates_room_and_blank_name_is_anonymous(tmp_path: Path) -> None:
    with TestClient(create_app(data_dir=tmp_path)) as client:
        with client.websocket_connect("/ws/rooms/new-room?name=%20%20") as socket:
            init = socket.receive_json()

        fetched = client.get("/api/rooms/new-room")

    assert init["users"][0]["name"] == "Anonymous"
    assert fetched.status_code == 200

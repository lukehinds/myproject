import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.main import create_app


def test_health(tmp_path: Path) -> None:
    with TestClient(create_app(data_dir=tmp_path)) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_get_and_unknown_room(tmp_path: Path, scene: dict[str, Any]) -> None:
    with TestClient(create_app(data_dir=tmp_path)) as client:
        created = client.post("/api/rooms")
        room_id = created.json()["roomId"]
        fetched = client.get(f"/api/rooms/{room_id}")
        missing = client.get("/api/rooms/not-a-room")

    assert created.status_code == 200
    assert len(room_id) == 21
    assert fetched.status_code == 200
    assert fetched.json() == {"roomId": room_id, "scene": scene, "users": []}
    assert missing.status_code == 404


def test_put_scene_merges_and_returns_authoritative_scene(
    tmp_path: Path,
    scene: dict[str, Any],
    element: Callable[..., dict[str, Any]],
) -> None:
    with TestClient(create_app(data_dir=tmp_path)) as client:
        room_id = client.post("/api/rooms").json()["roomId"]
        initial = {**scene, "elements": [element(version=2, versionNonce=50, x=20)]}
        first = client.put(f"/api/rooms/{room_id}/scene", json=initial)
        stale = {**scene, "elements": [element(version=1, versionNonce=1, x=999)]}
        second = client.put(f"/api/rooms/{room_id}/scene", json=stale)

    assert first.status_code == 200
    assert first.json()["ok"] is True
    assert second.status_code == 200
    assert second.json()["scene"]["elements"][0]["x"] == 20


def test_put_unknown_room_is_404(tmp_path: Path, scene: dict[str, Any]) -> None:
    with TestClient(create_app(data_dir=tmp_path)) as client:
        response = client.put("/api/rooms/unknown/scene", json=scene)

    assert response.status_code == 404


def test_room_is_loaded_lazily_after_restart(
    tmp_path: Path,
    scene: dict[str, Any],
    element: Callable[..., dict[str, Any]],
) -> None:
    with TestClient(create_app(data_dir=tmp_path, debounce_seconds=0.01)) as client:
        room_id = client.post("/api/rooms").json()["roomId"]
        client.put(
            f"/api/rooms/{room_id}/scene",
            json={**scene, "elements": [element()]},
        )

    with TestClient(create_app(data_dir=tmp_path)) as restarted:
        response = restarted.get(f"/api/rooms/{room_id}")

    assert response.status_code == 200
    assert response.json()["scene"]["elements"] == [element()]


def test_new_elements_append_and_z_index_order_survives_restart(
    tmp_path: Path,
    scene: dict[str, Any],
    element: Callable[..., dict[str, Any]],
) -> None:
    front = element(id="front---0000000000000", zIndex=10)
    back = element(id="back----0000000000000", zIndex=-5)
    with TestClient(create_app(data_dir=tmp_path)) as client:
        room_id = client.post("/api/rooms").json()["roomId"]
        client.put(f"/api/rooms/{room_id}/scene", json={**scene, "elements": [front]})
        client.put(f"/api/rooms/{room_id}/scene", json={**scene, "elements": [back]})
        stored = client.get(f"/api/rooms/{room_id}").json()["scene"]["elements"]

    with TestClient(create_app(data_dir=tmp_path)) as restarted:
        reloaded = restarted.get(f"/api/rooms/{room_id}").json()["scene"]["elements"]

    assert [item["id"] for item in stored] == [front["id"], back["id"]]
    assert reloaded == stored
    assert [
        item["id"] for item in sorted(reloaded, key=lambda item: (item["zIndex"], item["id"]))
    ] == [
        back["id"],
        front["id"],
    ]


def test_old_room_file_gets_z_indexes_from_array_order(
    tmp_path: Path,
    scene: dict[str, Any],
    element: Callable[..., dict[str, Any]],
) -> None:
    first = element(id="first---0000000000000")
    second = element(id="second--0000000000000")
    first.pop("zIndex")
    second.pop("zIndex")
    room_path = tmp_path / "rooms" / "legacy-room.json"
    room_path.parent.mkdir(parents=True)
    room_path.write_text(json.dumps({**scene, "elements": [first, second]}))

    with TestClient(create_app(data_dir=tmp_path)) as client:
        response = client.get("/api/rooms/legacy-room")

    assert response.status_code == 200
    migrated = response.json()["scene"]["elements"]
    assert [item["zIndex"] for item in migrated] == [0, 1]
    persisted = json.loads(room_path.read_text())
    assert [item["zIndex"] for item in persisted["elements"]] == [0, 1]

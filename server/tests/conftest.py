from collections.abc import Callable
from typing import Any

import pytest


@pytest.fixture
def element() -> Callable[..., dict[str, Any]]:
    def make_element(**overrides: Any) -> dict[str, Any]:
        value: dict[str, Any] = {
            "id": "element-0000000000000",
            "type": "rectangle",
            "x": 10,
            "y": 20,
            "width": 100,
            "height": 50,
            "zIndex": 0,
            "angle": 0,
            "strokeColor": "#1e1e1e",
            "backgroundColor": "transparent",
            "fillStyle": "solid",
            "strokeWidth": 2,
            "strokeStyle": "solid",
            "roughness": 1,
            "opacity": 100,
            "seed": 12345,
            "version": 1,
            "versionNonce": 100,
            "updated": 1_700_000_000_000,
            "isDeleted": False,
        }
        value.update(overrides)
        return value

    return make_element


@pytest.fixture
def scene() -> dict[str, Any]:
    return {"elements": [], "appState": {"viewBackgroundColor": "#ffffff"}}

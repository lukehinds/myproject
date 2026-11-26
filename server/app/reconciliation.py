import json
from collections.abc import Iterable

from .models import Element


def canonical(element: Element) -> str:
    value = element.model_dump(exclude_none=True)
    value.pop("updated", None)
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def incoming_wins(stored: Element | None, incoming: Element) -> bool:
    return (
        stored is None
        or incoming.version > stored.version
        or (incoming.version == stored.version and incoming.versionNonce < stored.versionNonce)
        or (
            incoming.version == stored.version
            and incoming.versionNonce == stored.versionNonce
            and canonical(incoming) < canonical(stored)
        )
    )


def merge_elements(stored: list[Element], incoming: Iterable[Element]) -> list[Element]:
    """Merge elements in place-order and return only incoming winners."""
    positions = {element.id: index for index, element in enumerate(stored)}
    winners: dict[str, Element] = {}
    for candidate in incoming:
        position = positions.get(candidate.id)
        current = stored[position] if position is not None else None
        if not incoming_wins(current, candidate):
            continue
        if position is None:
            positions[candidate.id] = len(stored)
            stored.append(candidate)
        else:
            stored[position] = candidate
        winners[candidate.id] = candidate
    return list(winners.values())

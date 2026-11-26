import itertools
from collections.abc import Callable
from typing import Any

from app.models import Element
from app.reconciliation import merge_elements


def parsed(factory: Callable[..., dict[str, Any]], **overrides: Any) -> Element:
    return Element.model_validate(factory(**overrides))


def test_new_element_wins(element: Callable[..., dict[str, Any]]) -> None:
    stored: list[Element] = []
    incoming = parsed(element)

    assert merge_elements(stored, [incoming]) == [incoming]
    assert stored == [incoming]


def test_higher_version_wins_and_keeps_position(element: Callable[..., dict[str, Any]]) -> None:
    existing = parsed(element, version=1, x=1)
    other = parsed(element, id="another-0000000000000")
    replacement = parsed(element, version=2, x=2)
    stored = [existing, other]

    assert merge_elements(stored, [replacement]) == [replacement]
    assert stored == [replacement, other]


def test_equal_version_lower_nonce_wins(element: Callable[..., dict[str, Any]]) -> None:
    existing = parsed(element, version=3, versionNonce=20)
    incoming = parsed(element, version=3, versionNonce=10)
    stored = [existing]

    assert merge_elements(stored, [incoming]) == [incoming]
    assert stored == [incoming]


def test_stale_live_element_cannot_resurrect_tombstone(
    element: Callable[..., dict[str, Any]],
) -> None:
    tombstone = parsed(element, version=5, versionNonce=50, isDeleted=True)
    stale_live = parsed(element, version=4, versionNonce=1, isDeleted=False)
    stored = [tombstone]

    assert merge_elements(stored, [stale_live]) == []
    assert stored == [tombstone]


def test_equal_or_lower_priority_is_ignored(element: Callable[..., dict[str, Any]]) -> None:
    existing = parsed(element, version=3, versionNonce=20)
    equal_nonce = parsed(element, version=3, versionNonce=20, x=30)
    higher_nonce = parsed(element, version=3, versionNonce=21, x=31)
    lower_version = parsed(element, version=2, versionNonce=1, x=32)
    stored = [existing]

    assert merge_elements(stored, [equal_nonce, higher_nonce, lower_version]) == []
    assert stored == [existing]


def test_canonical_tie_break_converges_for_every_permutation(
    element: Callable[..., dict[str, Any]],
) -> None:
    conflicts = [
        parsed(element, version=4, versionNonce=10, x=3, updated=300),
        parsed(element, version=4, versionNonce=10, x=1, updated=999),
        parsed(element, version=4, versionNonce=10, x=2, updated=100),
    ]
    results: list[dict[str, Any]] = []

    for permutation in itertools.permutations(conflicts):
        stored: list[Element] = []
        merge_elements(stored, permutation)
        results.append(stored[0].model_dump())

    assert all(result["x"] == 1 for result in results)
    assert all(result == results[0] for result in results)


def test_equal_version_and_nonce_conflict_converges_in_both_orders(
    element: Callable[..., dict[str, Any]],
) -> None:
    left = parsed(element, version=7, versionNonce=42, x=1)
    right = parsed(element, version=7, versionNonce=42, x=2)
    results: list[Element] = []

    for order in ((left, right), (right, left)):
        stored: list[Element] = []
        merge_elements(stored, order)
        results.append(stored[0])

    assert results == [left, left]


def test_canonical_tie_break_ignores_updated(element: Callable[..., dict[str, Any]]) -> None:
    existing = parsed(element, version=2, versionNonce=10, x=1, updated=999)
    incoming = parsed(element, version=2, versionNonce=10, x=1, updated=1)
    stored = [existing]

    assert merge_elements(stored, [incoming]) == []
    assert stored == [existing]


def test_batch_with_repeated_id_returns_only_final_winner(
    element: Callable[..., dict[str, Any]],
) -> None:
    version_two = parsed(element, version=2, x=2)
    version_three = parsed(element, version=3, x=3)
    stored: list[Element] = []

    assert merge_elements(stored, [version_two, version_three]) == [version_three]
    assert stored == [version_three]

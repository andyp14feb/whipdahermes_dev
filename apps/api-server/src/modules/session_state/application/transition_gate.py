from __future__ import annotations

from typing import Final


TRANSITION_ASSESS_STATUSES: Final[frozenset[str]] = frozenset({
    "stuck",
    "waiting",
    "waiting_input",
})


def should_assess_status(status: str) -> bool:
    return status in TRANSITION_ASSESS_STATUSES


def should_assess_transition(
    old_status: str | None,
    new_status: str,
) -> bool:
    if old_status is None:
        return False
    if old_status == new_status:
        return False
    return new_status in TRANSITION_ASSESS_STATUSES

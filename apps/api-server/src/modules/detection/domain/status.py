from __future__ import annotations

from enum import Enum


class Status(str, Enum):
    ACTIVE = "active"
    STABLE = "stable"
    WAITING = "waiting"
    WAITING_INPUT = "waiting_input"
    STUCK = "stuck"
    STALE = "stale"
    UNKNOWN = "unknown"

    @property
    def label(self) -> str:
        return {
            Status.ACTIVE: "Active",
            Status.STABLE: "Stable",
            Status.WAITING: "Waiting",
            Status.WAITING_INPUT: "Waiting for Input",
            Status.STUCK: "Stuck",
            Status.STALE: "Stale",
            Status.UNKNOWN: "Unknown",
        }[self]

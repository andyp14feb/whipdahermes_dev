from __future__ import annotations

from datetime import datetime, timezone


def now_utc() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def parse_iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    elif dt.tzinfo.utcoffset(dt) != timezone.utc.utcoffset(datetime.min):
        dt = dt.astimezone(timezone.utc)
    return dt

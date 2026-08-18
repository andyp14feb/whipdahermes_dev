from __future__ import annotations

from contextlib import contextmanager
from threading import RLock
from typing import Iterator

_write_lock = RLock()


@contextmanager
def sqlite_write_lock() -> Iterator[None]:
    """Serialize SQLite write transactions inside the API process.

    SQLite supports only one writer at a time. The API receives concurrent
    heartbeat and command requests, so without a process-local lock they can
    stampede into busy timeouts even with WAL enabled.
    """
    with _write_lock:
        yield

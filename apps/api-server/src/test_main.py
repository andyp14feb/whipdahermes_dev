from __future__ import annotations

import inspect

import main


def test_stale_sweeper_runs_synchronous_sweep_off_event_loop():
    source = inspect.getsource(main.start_stale_sweeper)

    assert "asyncio.to_thread(stale_detector.sweep)" in source

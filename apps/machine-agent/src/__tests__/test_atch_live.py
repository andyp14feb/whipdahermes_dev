from __future__ import annotations

import os
import time

import pytest

from terminal.atch_live import AtchLiveSession, atch_name_from_session_id


def test_atch_name_from_session_id():
    assert atch_name_from_session_id("atch:worker") == "worker"
    assert atch_name_from_session_id("worker") == "worker"


def test_atch_live_rejects_empty_name():
    errors: list[tuple[str, str]] = []
    live = AtchLiveSession(
        session_id="atch:",
        on_output=lambda *_: None,
        on_error=lambda sid, msg: errors.append((sid, msg)),
        on_ready=lambda *_: None,
        on_snapshot=lambda *_: None,
    )
    live.start()
    # Empty name fails synchronously before the reader thread starts.
    assert live._thread is None
    assert errors
    assert "invalid" in errors[0][1].lower()


def test_atch_live_errors_when_binary_missing(tmp_path):
    errors: list[str] = []
    live = AtchLiveSession(
        session_id="atch:missing-session",
        on_output=lambda *_: None,
        on_error=lambda _sid, msg: errors.append(msg),
        on_ready=lambda *_: None,
        on_snapshot=lambda *_: None,
        atch_bin=str(tmp_path / "no-such-atch"),
    )
    live.start()
    assert live._thread is not None
    live._thread.join(timeout=5)
    assert errors
    assert any(
        "atch binary not found" in msg or "failed" in msg.lower() or "ended" in msg
        for msg in errors
    )
    live.stop()


def test_subscribe_routes_atch_to_atch_live(monkeypatch):
    from terminal.agent_ws_client import TerminalAgentClient

    client = TerminalAgentClient(
        api_url="http://127.0.0.1:8000",
        machine_id="m1",
        tmux_socket=None,
    )
    created: list[tuple[str, str]] = []

    class _FakeAtch:
        def __init__(self, session_id, **_kwargs):
            self.session_id = session_id
            created.append(("atch", session_id))

        def start(self):
            pass

        def stop(self):
            pass

        def refresh_for_viewer(self):
            pass

    class _FakeTmux:
        def __init__(self, session_id, **_kwargs):
            self.session_id = session_id
            created.append(("tmux", session_id))

        def start(self):
            pass

        def stop(self):
            pass

        def refresh_for_viewer(self):
            pass

    monkeypatch.setattr("terminal.agent_ws_client.AtchLiveSession", _FakeAtch)
    monkeypatch.setattr("terminal.agent_ws_client.TmuxLiveSession", _FakeTmux)

    client._subscribe("atch:smoke")
    client._subscribe("tmux:pane")
    assert created == [("atch", "atch:smoke"), ("tmux", "tmux:pane")]
    assert set(client._sessions) == {"atch:smoke", "tmux:pane"}


@pytest.mark.skipif(
    os.environ.get("ATCH_INTEGRATION") != "1",
    reason="needs real atch binary + session",
)
def test_atch_live_pty_roundtrip_integration():
    """Optional: ATCH_INTEGRATION=1 atch start … then run this."""
    import threading

    name = os.environ.get("ATCH_TEST_SESSION", "p3smoke")
    outputs: list[str] = []
    errors: list[str] = []
    ready = threading.Event()

    live = AtchLiveSession(
        session_id=f"atch:{name}",
        on_output=lambda _sid, data: outputs.append(data),
        on_error=lambda _sid, msg: errors.append(msg),
        on_ready=lambda _sid: ready.set(),
        on_snapshot=lambda *_: None,
    )
    live.start()
    assert ready.wait(5), f"not ready; errors={errors}"
    live.send_input("echo WHIPAI_ATCH_LIVE_OK\n")
    deadline = time.time() + 5
    joined = ""
    while time.time() < deadline:
        joined = "".join(outputs)
        if "WHIPAI_ATCH_LIVE_OK" in joined:
            break
        time.sleep(0.1)
    live.stop()
    assert "WHIPAI_ATCH_LIVE_OK" in joined

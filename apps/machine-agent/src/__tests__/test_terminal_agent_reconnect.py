from terminal.agent_ws_client import (
    RECONNECT_BASE_SECONDS,
    RECONNECT_MAX_SECONDS,
    TerminalAgentClient,
    reconnect_delay_seconds,
)


class _FakeLive:
    def __init__(self, session_id):
        self.session_id = session_id
        self.started = False
        self.stopped = False
        self.refreshed = False

    def start(self):
        self.started = True

    def stop(self):
        self.stopped = True

    def refresh_for_viewer(self):
        self.refreshed = True


def test_reconnect_delay_grows_and_caps():
    d0 = reconnect_delay_seconds(0, base=1.0, max_delay=30.0)
    d3 = reconnect_delay_seconds(3, base=1.0, max_delay=30.0)
    d20 = reconnect_delay_seconds(20, base=1.0, max_delay=30.0)
    assert 1.0 <= d0 <= 2.0
    assert d3 >= d0
    assert d20 <= 30.0 + 1.0  # cap + jitter allowance


def test_desired_sessions_survive_live_stop(monkeypatch):
    client = TerminalAgentClient(
        api_url="http://127.0.0.1:8000",
        machine_id="m1",
        tmux_socket=None,
        reconnect_seconds=RECONNECT_BASE_SECONDS,
        reconnect_max_seconds=RECONNECT_MAX_SECONDS,
    )
    created = []

    def fake_live(**kwargs):
        live = _FakeLive(kwargs["session_id"])
        created.append(live)
        return live

    monkeypatch.setattr("terminal.agent_ws_client.TmuxLiveSession", fake_live)
    monkeypatch.setattr("terminal.agent_ws_client.is_atch_session", lambda _sid: False)

    client._subscribe("tmux:a")
    client._subscribe("tmux:b")
    assert client._desired_sessions == {"tmux:a", "tmux:b"}
    assert len(client._sessions) == 2

    client._stop_live_sessions_only()
    assert client._sessions == {}
    assert client._desired_sessions == {"tmux:a", "tmux:b"}
    assert all(live.stopped for live in created)

    # Simulate on_open re-subscribe of desired sessions.
    before = len(created)
    for sid in list(client._desired_sessions):
        client._subscribe(sid)
    assert len(client._sessions) == 2
    assert len(created) == before + 2
    assert all(live.started for live in created[-2:])


def test_unsubscribe_clears_desired(monkeypatch):
    client = TerminalAgentClient(
        api_url="http://127.0.0.1:8000",
        machine_id="m1",
        tmux_socket=None,
    )
    monkeypatch.setattr(
        "terminal.agent_ws_client.TmuxLiveSession",
        lambda **kwargs: _FakeLive(kwargs["session_id"]),
    )
    monkeypatch.setattr("terminal.agent_ws_client.is_atch_session", lambda _sid: False)

    client._subscribe("tmux:a")
    client._unsubscribe("tmux:a")
    assert "tmux:a" not in client._desired_sessions
    assert client._sessions == {}

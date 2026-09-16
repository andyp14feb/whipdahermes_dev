from terminal.agent_ws_client import MAX_LIVE_SESSIONS, TerminalAgentClient


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


def test_subscribe_caps_concurrent_sessions(monkeypatch):
    client = TerminalAgentClient(
        api_url="http://127.0.0.1:8000",
        machine_id="m1",
        tmux_socket=None,
        max_live_sessions=MAX_LIVE_SESSIONS,
    )
    sent = []
    client._send = sent.append  # type: ignore[method-assign]

    created = []

    def fake_live(**kwargs):
        live = _FakeLive(kwargs["session_id"])
        created.append(live)
        return live

    monkeypatch.setattr("terminal.agent_ws_client.TmuxLiveSession", fake_live)
    monkeypatch.setattr("terminal.agent_ws_client.is_atch_session", lambda _sid: False)

    for i in range(MAX_LIVE_SESSIONS):
        client._subscribe(f"tmux:s{i}")
    assert len(client._sessions) == MAX_LIVE_SESSIONS
    assert all(live.started for live in created)

    client._subscribe("tmux:extra")
    assert len(client._sessions) == MAX_LIVE_SESSIONS
    assert any(msg.get("type") == "error" and "Max" in msg.get("message", "") for msg in sent)

    # Re-subscribe existing session refreshes instead of creating another.
    before = len(created)
    client._subscribe("tmux:s0")
    assert len(created) == before
    assert created[0].refreshed is True

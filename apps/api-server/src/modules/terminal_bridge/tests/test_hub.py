import asyncio

import pytest

from modules.terminal_bridge.hub import MAX_LIVE_SESSIONS_PER_MACHINE, TerminalHub


class _FakeWS:
    def __init__(self, name: str):
        self.name = name
        self.closed = False
        self.close_code = None

    async def close(self, code=1000, reason=""):
        self.closed = True
        self.close_code = code


@pytest.mark.asyncio
async def test_hub_allows_multiple_sessions_up_to_cap():
    hub = TerminalHub()
    machine = "m1"
    sockets = []
    for i in range(MAX_LIVE_SESSIONS_PER_MACHINE):
        ws = _FakeWS(f"s{i}")
        sockets.append(ws)
        err = await hub.register_browser(machine, f"tmux:sess-{i}", ws)
        assert err is None
    assert hub.live_session_count(machine) == MAX_LIVE_SESSIONS_PER_MACHINE

    overflow = _FakeWS("overflow")
    err = await hub.register_browser(machine, "tmux:sess-extra", overflow)
    assert err is not None
    assert "Max" in err
    assert hub.live_session_count(machine) == MAX_LIVE_SESSIONS_PER_MACHINE


@pytest.mark.asyncio
async def test_hub_allows_same_session_reopen_when_at_cap():
    hub = TerminalHub()
    machine = "m1"
    for i in range(MAX_LIVE_SESSIONS_PER_MACHINE):
        assert (
            await hub.register_browser(machine, f"tmux:sess-{i}", _FakeWS(f"a{i}"))
        ) is None

    # Second viewer on an already-live session must be allowed (fan-out).
    second = _FakeWS("viewer2")
    err = await hub.register_browser(machine, "tmux:sess-0", second)
    assert err is None
    assert len(hub.get_browsers(machine, "tmux:sess-0")) == 2


@pytest.mark.asyncio
async def test_hub_unsubscribe_only_when_last_viewer_leaves():
    hub = TerminalHub()
    machine = "m1"
    session = "tmux:a"
    a = _FakeWS("a")
    b = _FakeWS("b")
    await hub.register_browser(machine, session, a)
    await hub.register_browser(machine, session, b)

    last = await hub.unregister_browser(machine, session, a)
    assert last is False
    assert hub.get_browsers(machine, session) == [b]

    last = await hub.unregister_browser(machine, session, b)
    assert last is True
    assert hub.get_browsers(machine, session) == []


@pytest.mark.asyncio
async def test_hub_tracks_sessions_per_machine_independently():
    hub = TerminalHub()
    for i in range(MAX_LIVE_SESSIONS_PER_MACHINE):
        assert (
            await hub.register_browser("m1", f"tmux:a-{i}", _FakeWS(f"m1-{i}"))
        ) is None
        assert (
            await hub.register_browser("m2", f"tmux:b-{i}", _FakeWS(f"m2-{i}"))
        ) is None
    assert hub.live_session_count("m1") == MAX_LIVE_SESSIONS_PER_MACHINE
    assert hub.live_session_count("m2") == MAX_LIVE_SESSIONS_PER_MACHINE

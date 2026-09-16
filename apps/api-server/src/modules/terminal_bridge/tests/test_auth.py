import os

from modules.terminal_bridge.auth import check_terminal_token, terminal_token


class _FakeWS:
    def __init__(self, query=None, headers=None):
        self.query_params = query or {}
        self.headers = headers or {}


def test_token_allows_when_unset(monkeypatch):
    monkeypatch.delenv("WHIPAI_TERMINAL_TOKEN", raising=False)
    assert terminal_token() == ""
    assert check_terminal_token(_FakeWS()) is True


def test_token_requires_match(monkeypatch):
    monkeypatch.setenv("WHIPAI_TERMINAL_TOKEN", "secret")
    assert check_terminal_token(_FakeWS(query={"token": "secret"})) is True
    assert check_terminal_token(_FakeWS(query={"token": "nope"})) is False
    assert check_terminal_token(
        _FakeWS(headers={"x-whipai-terminal-token": "secret"})
    ) is True

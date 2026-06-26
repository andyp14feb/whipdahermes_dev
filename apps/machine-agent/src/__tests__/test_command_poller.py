from unittest.mock import Mock, patch
import pytest

from command.command_poller import CommandPoller, Command


def _make_response(json_data=None, status_code=200):
    resp = Mock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    resp.text = "error"
    return resp


class TestCommandPollerFetchPending:
    def test_success_returns_commands(self):
        poller = CommandPoller("http://localhost:8000")
        resp = _make_response({
            "commands": [
                {"command_id": "c1", "session_id": "s1", "payload": "ls"},
                {"command_id": "c2", "session_id": "s2", "payload": "pwd"},
            ]
        })
        with patch("command.command_poller.requests.get", return_value=resp) as mock_get:
            result = poller.fetch_pending("vm-1")
        assert len(result) == 2
        assert result[0] == Command(command_id="c1", session_id="s1", payload="ls")
        assert result[1] == Command(command_id="c2", session_id="s2", payload="pwd")
        mock_get.assert_called_once_with("http://localhost:8000/commands/vm-1", timeout=10)

    def test_empty_commands(self):
        poller = CommandPoller("http://localhost:8000")
        resp = _make_response({"commands": []})
        with patch("command.command_poller.requests.get", return_value=resp):
            assert poller.fetch_pending("vm-1") == []

    def test_no_commands_key(self):
        poller = CommandPoller("http://localhost:8000")
        resp = _make_response({})
        with patch("command.command_poller.requests.get", return_value=resp):
            assert poller.fetch_pending("vm-1") == []

    def test_invalid_json(self):
        poller = CommandPoller("http://localhost:8000")
        with patch("command.command_poller.requests.get") as mock_get:
            mock_get.return_value.json.side_effect = ValueError("bad json")
            mock_get.return_value.status_code = 200
            assert poller.fetch_pending("vm-1") == []

    def test_http_422_returns_empty(self):
        poller = CommandPoller("http://localhost:8000")
        resp = _make_response(status_code=422)
        with patch("command.command_poller.requests.get", return_value=resp):
            assert poller.fetch_pending("vm-1") == []

    def test_http_500_returns_empty(self):
        poller = CommandPoller("http://localhost:8000")
        resp = _make_response(status_code=500)
        with patch("command.command_poller.requests.get", return_value=resp):
            assert poller.fetch_pending("vm-1") == []

    def test_network_error_returns_empty(self):
        poller = CommandPoller("http://localhost:8000")
        from requests.exceptions import ConnectionError
        with patch("command.command_poller.requests.get", side_effect=ConnectionError("network")):
            assert poller.fetch_pending("vm-1") == []

    def test_missing_command_id_skipped(self):
        poller = CommandPoller("http://localhost:8000")
        resp = _make_response({"commands": [{"session_id": "s1", "payload": "ls"}]})
        with patch("command.command_poller.requests.get", return_value=resp):
            assert poller.fetch_pending("vm-1") == []

    def test_missing_session_id_skipped(self):
        poller = CommandPoller("http://localhost:8000")
        resp = _make_response({"commands": [{"command_id": "c1", "payload": "ls"}]})
        with patch("command.command_poller.requests.get", return_value=resp):
            assert poller.fetch_pending("vm-1") == []

    def test_non_list_commands_returns_empty(self):
        poller = CommandPoller("http://localhost:8000")
        resp = _make_response({"commands": "not-a-list"})
        with patch("command.command_poller.requests.get", return_value=resp):
            assert poller.fetch_pending("vm-1") == []

    def test_strips_trailing_slash(self):
        poller = CommandPoller("http://localhost:8000/")
        resp = _make_response({"commands": []})
        with patch("command.command_poller.requests.get", return_value=resp) as mock_get:
            poller.fetch_pending("vm-1")
        mock_get.assert_called_once_with("http://localhost:8000/commands/vm-1", timeout=10)

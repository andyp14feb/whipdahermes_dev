from unittest.mock import Mock, patch

from heartbeat.heartbeat_client import HeartbeatClient
from parse.capture_parser import SessionSnapshot


def _make_snapshot(session_id="miniwa:0.0") -> SessionSnapshot:
    return SessionSnapshot(
        session_id=session_id,
        label="miniwa",
        preview="hello",
        cwd="/tmp",
        diff_pct=0.0,
        stable_counter=3,
        seconds_since_change=6,
        captured_at="2026-06-24T08:15:00Z",
    )


def test_post_heartbeat_success():
    client = HeartbeatClient("http://localhost:8000")
    snapshot = _make_snapshot()
    with patch.object(client.session, "post") as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"ok": True, "accepted": 1}
        result = client.post_heartbeat("vm-1", [snapshot])

    assert result is True
    mock_post.assert_called_once_with(
        "http://localhost:8000/heartbeat",
        json={
            "machine_id": "vm-1",
            "sessions": [
                {
                    "session_id": "miniwa:0.0",
                    "label": "miniwa",
                    "preview": "hello",
                    "cwd": "/tmp",
                    "diff_pct": 0.0,
                    "stable_counter": 3,
                    "seconds_since_change": 6,
                    "captured_at": "2026-06-24T08:15:00Z",
                }
            ],
        },
        headers={"Content-Type": "application/json"},
        timeout=30,
    )


def test_post_heartbeat_connection_error(caplog):
    client = HeartbeatClient("http://localhost:8000")
    with patch.object(client.session, "post") as mock_post:
        from requests.exceptions import ConnectionError as RequestsConnectionError
        mock_post.side_effect = RequestsConnectionError("connection refused")
        result = client.post_heartbeat("vm-1", [])

    assert result is False
    assert len(caplog.records) == 1
    assert "Failed to POST heartbeat" in caplog.text


def test_post_heartbeat_http_422(caplog):
    client = HeartbeatClient("http://localhost:8000")
    with patch.object(client.session, "post") as mock_post:
        mock_post.return_value.status_code = 422
        mock_post.return_value.text = '{"detail": "validation error"}'
        result = client.post_heartbeat("vm-1", [])

    assert result is False
    assert "validation error" in caplog.text


def test_post_heartbeat_http_404(caplog):
    client = HeartbeatClient("http://localhost:8000")
    with patch.object(client.session, "post") as mock_post:
        mock_post.return_value.status_code = 404
        result = client.post_heartbeat("vm-1", [])

    assert result is False
    assert "Heartbeat endpoint not found" in caplog.text


def test_post_heartbeat_ok_false(caplog):
    client = HeartbeatClient("http://localhost:8000")
    with patch.object(client.session, "post") as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"ok": False}
        result = client.post_heartbeat("vm-1", [])

    assert result is False
    assert "Heartbeat response rejected" in caplog.text


def test_post_heartbeat_trailing_slash_stripped():
    client = HeartbeatClient("http://localhost:8000/")
    with patch.object(client.session, "post") as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"ok": True, "accepted": 1}
        result = client.post_heartbeat("vm-1", [])

    assert result is True
    mock_post.assert_called_once_with(
        "http://localhost:8000/heartbeat",
        json={"machine_id": "vm-1", "sessions": []},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )


def test_post_heartbeat_api_url_with_path_and_trailing_slash_builds_expected_url():
    client = HeartbeatClient("http://localhost:8000/api/")
    with patch.object(client.session, "post") as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"ok": True, "accepted": 1}
        result = client.post_heartbeat("vm-1", [])

    assert result is True
    mock_post.assert_called_once_with(
        "http://localhost:8000/api/heartbeat",
        json={"machine_id": "vm-1", "sessions": []},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )


def test_post_heartbeat_invalid_json_response(caplog):
    client = HeartbeatClient("http://localhost:8000")
    with patch.object(client.session, "post") as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.side_effect = ValueError("No JSON object could be decoded")
        result = client.post_heartbeat("vm-1", [])

    assert result is False
    assert "invalid JSON" in caplog.text


def test_post_heartbeat_http_500(caplog):
    client = HeartbeatClient("http://localhost:8000")
    with patch.object(client.session, "post") as mock_post:
        mock_post.return_value.status_code = 500
        result = client.post_heartbeat("vm-1", [])

    assert result is False
    assert "HTTP 500" in caplog.text


def test_post_heartbeat_empty_sessions():
    client = HeartbeatClient("http://localhost:8000")
    with patch.object(client.session, "post") as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"ok": True, "accepted": 0}
        result = client.post_heartbeat("vm-1", [])

    assert result is True
    mock_post.assert_called_once_with(
        "http://localhost:8000/heartbeat",
        json={"machine_id": "vm-1", "sessions": []},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )


def test_is_api_available_returns_false_on_connection_error(caplog):
    client = HeartbeatClient("http://localhost:8000")
    from requests.exceptions import ConnectionError as RequestsConnectionError
    with patch.object(client.session, "get", side_effect=RequestsConnectionError("connection refused")):
        result = client.is_api_available()

    assert result is False
    assert "API health check failed" in caplog.text


def test_is_api_available_uses_normalized_health_url():
    client = HeartbeatClient("http://localhost:8000/api/")
    with patch.object(client.session, "get") as mock_get:
        mock_get.return_value.status_code = 200
        result = client.is_api_available()

    assert result is True
    mock_get.assert_called_once_with("http://localhost:8000/api/health", timeout=5)

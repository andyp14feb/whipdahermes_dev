from terminal.agent_ws_client import http_to_ws_url


def test_http_to_ws_url():
    assert http_to_ws_url("http://localhost:8004", "/ws/agent/m1", "tok") == (
        "ws://localhost:8004/ws/agent/m1?token=tok"
    )
    assert http_to_ws_url("https://example.com", "/ws/agent/m1") == (
        "wss://example.com/ws/agent/m1"
    )

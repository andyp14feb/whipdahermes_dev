from __future__ import annotations

import hmac
import os

from fastapi import WebSocket


def terminal_token() -> str:
    return os.getenv("WHIPAI_TERMINAL_TOKEN", "").strip()


def extract_ws_token(websocket: WebSocket) -> str:
    query_token = websocket.query_params.get("token", "")
    if query_token:
        return query_token.strip()
    header = websocket.headers.get("x-whipai-terminal-token", "")
    return header.strip()


def check_terminal_token(websocket: WebSocket) -> bool:
    expected = terminal_token()
    if not expected:
        # Spike: allow if unset, but prefer setting WHIPAI_TERMINAL_TOKEN.
        return True
    provided = extract_ws_token(websocket)
    return hmac.compare_digest(provided, expected)

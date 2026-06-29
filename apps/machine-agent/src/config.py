from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class AgentConfig:
    machine_id: str
    api_url: str
    interval: int = 2
    command_poll_interval: int = 5
    tmux_socket: str | None = None


def _default_tmux_socket() -> str:
    uid = os.getuid()
    return f"/tmp/tmux-{uid}/default"


def load_config() -> AgentConfig:
    machine_id = os.getenv("MACHINE_ID", "").strip()
    api_url = os.getenv("API_URL", "").strip()
    interval_raw = os.getenv("INTERVAL", "2").strip()
    command_poll_interval_raw = os.getenv("COMMAND_POLL_INTERVAL", "5").strip()
    tmux_socket = os.getenv("TMUX_SOCKET", _default_tmux_socket()).strip() or None

    if not machine_id or not api_url:
        raise SystemExit("MACHINE_ID and API_URL must be set")

    try:
        interval = int(interval_raw)
    except ValueError as exc:
        raise SystemExit("INTERVAL must be an integer") from exc

    if interval < 1:
        raise SystemExit("INTERVAL must be a positive integer")

    try:
        command_poll_interval = int(command_poll_interval_raw)
    except ValueError as exc:
        raise SystemExit("COMMAND_POLL_INTERVAL must be an integer") from exc

    if command_poll_interval < 1:
        raise SystemExit("COMMAND_POLL_INTERVAL must be a positive integer")

    return AgentConfig(
        machine_id=machine_id,
        api_url=api_url,
        interval=interval,
        command_poll_interval=command_poll_interval,
        tmux_socket=tmux_socket,
    )

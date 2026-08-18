from __future__ import annotations

import os
import socket
from dataclasses import dataclass


@dataclass
class AgentConfig:
    machine_id: str
    api_url: str
    interval: int = 2
    command_poll_interval: int = 5
    tmux_socket: str | None = None
    session_backends: tuple[str, ...] = ("tmux",)


def _default_tmux_socket() -> str:
    uid = getattr(os, "getuid", os.getpid)()
    return f"/tmp/tmux-{uid}/default"


SUPPORTED_SESSION_BACKENDS = {"tmux", "atch"}


def _load_session_backends(raw: str) -> tuple[str, ...]:
    backends = tuple(dict.fromkeys(item.strip().lower() for item in raw.split(",") if item.strip()))
    if not backends:
        raise SystemExit("SESSION_BACKENDS must include at least one backend")
    unsupported = sorted(set(backends) - SUPPORTED_SESSION_BACKENDS)
    if unsupported:
        raise SystemExit(f"SESSION_BACKENDS contains unsupported backend(s): {', '.join(unsupported)}")
    return backends


def load_config() -> AgentConfig:
    machine_id = os.getenv("MACHINE_ID", "").strip() or socket.gethostname().strip()
    api_url = os.getenv("API_URL", "").strip()
    interval_raw = os.getenv("INTERVAL", "2").strip()
    command_poll_interval_raw = os.getenv("COMMAND_POLL_INTERVAL", "5").strip()
    configured_tmux_socket = os.getenv("TMUX_SOCKET")
    tmux_socket = (
        configured_tmux_socket if configured_tmux_socket is not None else _default_tmux_socket()
    ).strip() or None
    session_backends = _load_session_backends(os.getenv("SESSION_BACKENDS", "tmux"))

    if not machine_id or not api_url:
        raise SystemExit("API_URL must be set")

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
        session_backends=session_backends,
    )

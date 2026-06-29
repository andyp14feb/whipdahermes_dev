from __future__ import annotations


def build_tmux_command(args: list[str], tmux_socket: str | None = None) -> list[str]:
    """Build a tmux command, optionally targeting an explicit socket path."""
    if tmux_socket:
        return ["tmux", "-S", tmux_socket, *args]
    return ["tmux", *args]

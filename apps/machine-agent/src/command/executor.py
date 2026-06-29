from __future__ import annotations

import logging
import subprocess
import threading
from dataclasses import dataclass

from capture.tmux_command import build_tmux_command
from command.command_poller import Command

logger = logging.getLogger(__name__)


@dataclass
class ExecutionResult:
    command_id: str
    delivered: bool
    failure_reason: str | None


class AgentControlState:
    _instance: "AgentControlState | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self._updates_enabled = threading.Event()
        self._updates_enabled.set()
        self._shutdown_requested = threading.Event()
        self._restart_requested = threading.Event()

    @classmethod
    def get_instance(cls) -> "AgentControlState":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def stop_updates(self) -> None:
        self._updates_enabled.clear()

    def start_updates(self) -> None:
        self._updates_enabled.set()

    def updates_enabled(self) -> bool:
        return self._updates_enabled.is_set()

    def request_shutdown(self) -> None:
        self._shutdown_requested.set()

    def shutdown_requested(self) -> bool:
        return self._shutdown_requested.is_set()

    def request_restart(self) -> None:
        self._restart_requested.set()

    def restart_requested(self) -> bool:
        return self._restart_requested.is_set()

    def clear_restart(self) -> None:
        self._restart_requested.clear()

    def clear_shutdown(self) -> None:
        self._shutdown_requested.clear()


MAGIC_CONTROL_PAYLOADS = {
    "__whipai__:pause": lambda: AgentControlState.get_instance().stop_updates(),
    "__whipai__:resume": lambda: AgentControlState.get_instance().start_updates(),
    "__whipai__:shutdown": lambda: AgentControlState.get_instance().request_shutdown(),
    "__whipai__:restart": lambda: AgentControlState.get_instance().request_restart(),
}


class CommandExecutor:
    def __init__(self, tmux_socket: str | None = None):
        self.tmux_socket = tmux_socket

    def execute(self, command: Command) -> ExecutionResult:
        if command.payload in MAGIC_CONTROL_PAYLOADS:
            try:
                MAGIC_CONTROL_PAYLOADS[command.payload]()
                logger.info("Control command '%s' applied for command_id=%s", command.payload, command.command_id)
                return ExecutionResult(command_id=command.command_id, delivered=True, failure_reason=None)
            except Exception as exc:
                logger.warning("Control command '%s' failed for command_id=%s: %s", command.payload, command.command_id, exc)
                return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason=str(exc))

        try:
            subprocess.run(
                build_tmux_command(["send-keys", "-t", command.session_id, command.payload, "Enter"], self.tmux_socket),
                capture_output=True,
                text=True,
                check=True,
            )
        except subprocess.CalledProcessError as exc:
            logger.warning(
                "tmux send-keys failed for command_id=%s session_id=%s: %s",
                command.command_id,
                command.session_id,
                exc,
            )
            return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason=str(exc))
        except FileNotFoundError:
            logger.error(
                "tmux not installed for command_id=%s session_id=%s",
                command.command_id,
                command.session_id,
            )
            return ExecutionResult(
                command_id=command.command_id,
                delivered=False,
                failure_reason="tmux not installed",
            )

        logger.info(
            "tmux send-keys succeeded for command_id=%s session_id=%s",
            command.command_id,
            command.session_id,
        )
        return ExecutionResult(command_id=command.command_id, delivered=True, failure_reason=None)

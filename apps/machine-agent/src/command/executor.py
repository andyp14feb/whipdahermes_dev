from __future__ import annotations

import logging
import subprocess
import threading
from dataclasses import dataclass
import re

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

TMUX_SESSION_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$")
TMUX_TARGET_RE = re.compile(r"^[^|]+$")
CREATE_SESSION_PREFIX = "__whipai__:create_session:"
RENAME_SESSION_PREFIX = "__whipai__:rename_session:"


def _is_valid_tmux_session_name(name: str) -> bool:
    return bool(name and TMUX_SESSION_NAME_RE.match(name))


def _is_valid_tmux_target(name: str) -> bool:
    return bool(name and TMUX_TARGET_RE.match(name))


class CommandExecutor:
    def __init__(self, tmux_socket: str | None = None):
        self.tmux_socket = tmux_socket

    def _execute_create_session(self, command: Command) -> ExecutionResult:
        session_name = command.payload[len(CREATE_SESSION_PREFIX) :]
        if not _is_valid_tmux_session_name(session_name):
            reason = f"invalid session name: {session_name!r}"
            logger.warning("create_session rejected for command_id=%s: %s", command.command_id, reason)
            return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason=reason)
        try:
            subprocess.run(
                build_tmux_command(["new-session", "-d", "-s", session_name], self.tmux_socket),
                capture_output=True,
                text=True,
                check=True,
            )
        except subprocess.CalledProcessError as exc:
            logger.warning("tmux new-session failed for command_id=%s: %s", command.command_id, exc)
            return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason=str(exc))
        except FileNotFoundError:
            logger.error("tmux not installed for command_id=%s", command.command_id)
            return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason="tmux not installed")
        logger.info("tmux new-session succeeded for command_id=%s session_name=%s", command.command_id, session_name)
        return ExecutionResult(command_id=command.command_id, delivered=True, failure_reason=None)

    def _execute_rename_session(self, command: Command) -> ExecutionResult:
        payload_suffix = command.payload[len(RENAME_SESSION_PREFIX) :]
        parts = payload_suffix.split("|", 1)
        if len(parts) != 2:
            reason = "rename_session payload must be __whipai__:rename_session:<current>|<new>"
            logger.warning("rename_session rejected for command_id=%s: %s", command.command_id, reason)
            return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason=reason)
        current_name, new_name = parts
        if not _is_valid_tmux_target(current_name):
            reason = f"invalid current session target: {current_name!r}"
            logger.warning("rename_session rejected for command_id=%s: %s", command.command_id, reason)
            return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason=reason)
        if not _is_valid_tmux_session_name(new_name):
            reason = f"invalid new session name: {new_name!r}"
            logger.warning("rename_session rejected for command_id=%s: %s", command.command_id, reason)
            return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason=reason)
        try:
            subprocess.run(
                build_tmux_command(["rename-session", "-t", current_name, new_name], self.tmux_socket),
                capture_output=True,
                text=True,
                check=True,
            )
        except subprocess.CalledProcessError as exc:
            logger.warning("tmux rename-session failed for command_id=%s: %s", command.command_id, exc)
            return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason=str(exc))
        except FileNotFoundError:
            logger.error("tmux not installed for command_id=%s", command.command_id)
            return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason="tmux not installed")
        logger.info("tmux rename-session succeeded for command_id=%s %s->%s", command.command_id, current_name, new_name)
        return ExecutionResult(command_id=command.command_id, delivered=True, failure_reason=None)

    def execute(self, command: Command) -> ExecutionResult:
        if command.payload in MAGIC_CONTROL_PAYLOADS:
            try:
                MAGIC_CONTROL_PAYLOADS[command.payload]()
                logger.info("Control command '%s' applied for command_id=%s", command.payload, command.command_id)
                return ExecutionResult(command_id=command.command_id, delivered=True, failure_reason=None)
            except Exception as exc:
                logger.warning("Control command '%s' failed for command_id=%s: %s", command.payload, command.command_id, exc)
                return ExecutionResult(command_id=command.command_id, delivered=False, failure_reason=str(exc))

        if command.payload.startswith(CREATE_SESSION_PREFIX):
            return self._execute_create_session(command)

        if command.payload.startswith(RENAME_SESSION_PREFIX):
            return self._execute_rename_session(command)

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

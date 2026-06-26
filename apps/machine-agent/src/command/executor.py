from __future__ import annotations

import logging
import subprocess
from dataclasses import dataclass

from command.command_poller import Command

logger = logging.getLogger(__name__)


@dataclass
class ExecutionResult:
    command_id: str
    delivered: bool
    failure_reason: str | None


class CommandExecutor:
    def execute(self, command: Command) -> ExecutionResult:
        try:
            subprocess.run(
                ["tmux", "send-keys", "-t", command.session_id, command.payload, "Enter"],
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

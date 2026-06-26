import subprocess
from unittest.mock import patch

from command.command_poller import Command
from command.executor import CommandExecutor


def test_execute_sends_payload_to_tmux_session():
    executor = CommandExecutor()
    command = Command(command_id="cmd-1", session_id="sess:0.0", payload="continue")

    with patch("command.executor.subprocess.run") as run:
        result = executor.execute(command)

    assert result.command_id == "cmd-1"
    assert result.delivered is True
    assert result.failure_reason is None
    run.assert_called_once_with(
        ["tmux", "send-keys", "-t", "sess:0.0", "continue", "Enter"],
        capture_output=True,
        text=True,
        check=True,
    )


def test_execute_reports_called_process_error():
    executor = CommandExecutor()
    command = Command(command_id="cmd-1", session_id="missing", payload="continue")

    with patch(
        "command.executor.subprocess.run",
        side_effect=subprocess.CalledProcessError(1, ["tmux"]),
    ):
        result = executor.execute(command)

    assert result.command_id == "cmd-1"
    assert result.delivered is False
    assert result.failure_reason


def test_execute_reports_tmux_missing():
    executor = CommandExecutor()
    command = Command(command_id="cmd-1", session_id="sess", payload="continue")

    with patch("command.executor.subprocess.run", side_effect=FileNotFoundError):
        result = executor.execute(command)

    assert result.command_id == "cmd-1"
    assert result.delivered is False
    assert result.failure_reason == "tmux not installed"

from unittest.mock import Mock, patch

from config import AgentConfig
from command.command_poller import Command, CommandPoller
from command.command_reporter import CommandReporter
from command.command_scheduler import CommandScheduler
from command.executor import AgentControlState, ExecutionResult


def _config():
    control_state = AgentControlState.get_instance()
    control_state.start_updates()
    control_state.clear_shutdown()
    control_state.clear_restart()
    return AgentConfig(machine_id="vm-1", api_url="http://localhost:8000", interval=2, command_poll_interval=5, tmux_socket="/host-tmux/default")


def test_run_once_no_commands():
    poller = Mock(spec=CommandPoller)
    poller.fetch_pending.return_value = []
    executor = Mock()
    reporter = Mock(spec=CommandReporter)
    scheduler = CommandScheduler(_config(), poller, executor, reporter)

    scheduler.run_once()

    poller.fetch_pending.assert_called_once_with("vm-1")
    executor.execute.assert_not_called()
    reporter.report.assert_not_called()


def test_run_once_executes_and_reports_each_command():
    poller = Mock(spec=CommandPoller)
    commands = [
        Command(command_id="c1", session_id="s1", payload="ls"),
        Command(command_id="c2", session_id="s2", payload="pwd"),
    ]
    poller.fetch_pending.return_value = commands
    executor = Mock()
    executor.execute.side_effect = [
        ExecutionResult(command_id="c1", delivered=True, failure_reason=None),
        ExecutionResult(command_id="c2", delivered=False, failure_reason="boom"),
    ]
    reporter = Mock(spec=CommandReporter)
    reporter.report.side_effect = [True, False]
    scheduler = CommandScheduler(_config(), poller, executor, reporter)

    scheduler.run_once()

    assert executor.execute.call_count == 2
    assert reporter.report.call_count == 2
    executor.execute.assert_any_call(commands[0])
    executor.execute.assert_any_call(commands[1])


def test_run_forever_loops_until_keyboard_interrupt(monkeypatch):
    poller = Mock(spec=CommandPoller)
    poller.fetch_pending.return_value = []
    executor = Mock()
    reporter = Mock(spec=CommandReporter)
    scheduler = CommandScheduler(_config(), poller, executor, reporter)

    calls = {"count": 0}

    def fake_run_once():
        calls["count"] += 1
        if calls["count"] >= 2:
            raise KeyboardInterrupt()

    sleep_mock = Mock()
    scheduler.run_once = fake_run_once
    with patch("command.command_scheduler.time.sleep", sleep_mock):
        scheduler.run_forever()

    assert calls["count"] == 2
    sleep_mock.assert_called_once_with(5)

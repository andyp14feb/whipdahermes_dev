from unittest.mock import Mock, patch

from heartbeat.scheduler import HeartbeatScheduler
from command.executor import AgentControlState
from config import AgentConfig
from parse.capture_parser import CaptureState


def _make_config(interval=2):
    control_state = AgentControlState.get_instance()
    control_state.start_updates()
    control_state.clear_shutdown()
    control_state.clear_restart()
    return AgentConfig(machine_id="vm-1", api_url="http://localhost:8000", interval=interval)


def test_scheduler_run_once():
    config = _make_config()
    client = Mock()
    client.post_heartbeat.return_value = True
    capture_fn = Mock(return_value=[{"target": "miniwa:0.0", "text": "hello", "cwd": "/tmp"}])

    snapshots = []
    state_out = CaptureState()

    def fake_parse(panes, state, interval=1, threshold=1.0):
        nonlocal snapshots, state_out
        from parse.capture_parser import SessionSnapshot
        snapshots.append(1)
        return [], state_out

    scheduler = HeartbeatScheduler(config, client, capture_fn, fake_parse)
    result = scheduler.run_once()

    assert result is True
    capture_fn.assert_called_once()
    client.post_heartbeat.assert_called_once_with("vm-1", [])


def test_scheduler_preserves_state_on_failure(caplog):
    config = _make_config()
    client = Mock()
    client.post_heartbeat.return_value = False

    capture_fn = Mock(return_value=[])
    state = CaptureState()
    scheduler = HeartbeatScheduler(config, client, capture_fn, lambda panes, st, **kw: ([], st))
    scheduler.state = state

    result = scheduler.run_once()
    assert result is False
    assert scheduler.state is state
    assert "Heartbeat post failed" in caplog.text


def test_scheduler_keyboard_interrupt_during_sleep(caplog):
    config = _make_config(interval=5)
    client = Mock()
    client.post_heartbeat.return_value = True
    capture_fn = Mock(return_value=[])
    parse_fn = Mock(return_value=([], CaptureState()))
    scheduler = HeartbeatScheduler(config, client, capture_fn, parse_fn)

    with patch("heartbeat.scheduler.time.sleep", side_effect=KeyboardInterrupt()):
        scheduler.run_forever()

    capture_fn.assert_called_once()
    client.post_heartbeat.assert_called_once()


def test_scheduler_run_once_posts_empty_sessions_when_no_panes():
    config = _make_config()
    client = Mock()
    client.post_heartbeat.return_value = True
    capture_fn = Mock(return_value=[])
    parse_fn = Mock(return_value=([], CaptureState()))

    scheduler = HeartbeatScheduler(config, client, capture_fn, parse_fn)
    result = scheduler.run_once()

    assert result is True
    parse_fn.assert_called_once()
    client.post_heartbeat.assert_called_once_with("vm-1", [])


def test_scheduler_passes_configured_interval_to_parser():
    config = _make_config(interval=7)
    client = Mock()
    client.post_heartbeat.return_value = True
    capture_fn = Mock(return_value=[])
    parse_fn = Mock(return_value=([], CaptureState()))

    scheduler = HeartbeatScheduler(config, client, capture_fn, parse_fn)
    scheduler.run_once()

    parse_fn.assert_called_once()
    assert parse_fn.call_args.kwargs["interval"] == 7


def test_scheduler_run_forever_sleeps_between_ticks():
    config = _make_config(interval=3)
    client = Mock()
    client.post_heartbeat.return_value = True
    capture_fn = Mock(return_value=[])
    parse_fn = Mock(return_value=([], CaptureState()))
    scheduler = HeartbeatScheduler(config, client, capture_fn, parse_fn)

    with patch("heartbeat.scheduler.time.sleep", side_effect=KeyboardInterrupt()) as mock_sleep:
        scheduler.run_forever()

    capture_fn.assert_called_once()
    mock_sleep.assert_called_once_with(3)

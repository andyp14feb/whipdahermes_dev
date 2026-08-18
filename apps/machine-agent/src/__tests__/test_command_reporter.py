from unittest.mock import Mock, patch

from command.command_reporter import CommandReporter
from command.executor import ExecutionResult


def _result(delivered=True, failure_reason=None):
    return ExecutionResult(command_id="cmd-1", delivered=delivered, failure_reason=failure_reason)


def test_report_success_posts_delivery_payload():
    reporter = CommandReporter("http://localhost:8000")
    response = Mock(status_code=200)

    with patch("command.command_reporter.requests.post", return_value=response) as post:
        ok = reporter.report(_result(True, None))

    assert ok is True
    post.assert_called_once_with(
        "http://localhost:8000/commands/cmd-1/delivery",
        json={"delivered": True, "failure_reason": None},
        headers={"Content-Type": "application/json"},
        timeout=10,
    )


def test_report_returns_false_on_http_error():
    reporter = CommandReporter("http://localhost:8000")
    response = Mock(status_code=500)

    with patch("command.command_reporter.requests.post", return_value=response):
        ok = reporter.report(_result(False, "boom"))

    assert ok is False


def test_report_returns_false_on_404_with_endpoint_not_found_log(caplog):
    reporter = CommandReporter("http://localhost:8000")
    response = Mock(status_code=404)

    with patch("command.command_reporter.requests.post", return_value=response):
        ok = reporter.report(_result(False, "boom"))

    assert ok is False
    assert "Delivery report endpoint not found" in caplog.text


def test_report_returns_false_on_request_exception():
    reporter = CommandReporter("http://localhost:8000")

    from requests.exceptions import ConnectionError
    with patch("command.command_reporter.requests.post", side_effect=ConnectionError("network")):
        ok = reporter.report(_result(False, "boom"))

    assert ok is False


def test_report_strips_trailing_slash():
    reporter = CommandReporter("http://localhost:8000/")
    response = Mock(status_code=200)

    with patch("command.command_reporter.requests.post", return_value=response) as post:
        reporter.report(_result())

    assert post.call_args.args[0] == "http://localhost:8000/commands/cmd-1/delivery"


def test_report_api_url_with_path_and_trailing_slash_builds_expected_url():
    reporter = CommandReporter("http://localhost:8000/api/")
    response = Mock(status_code=200)

    with patch("command.command_reporter.requests.post", return_value=response) as post:
        reporter.report(_result())

    assert post.call_args.args[0] == "http://localhost:8000/api/commands/cmd-1/delivery"

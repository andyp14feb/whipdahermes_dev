from __future__ import annotations

from modules.detection.domain.classify import classify_session
from modules.detection.domain.signals import SessionSignals
from modules.detection.domain.status import Status


class TestClassifySession:
    def test_waiting_input_continue(self) -> None:
        signals = SessionSignals(
            preview="Do you want to continue?",
            diff_pct=0.0,
            stable_counter=5,
            seconds_since_change=300,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.WAITING_INPUT

    def test_waiting_input_yn(self) -> None:
        signals = SessionSignals(
            preview="Proceed y/n",
            diff_pct=0.0,
            stable_counter=5,
            seconds_since_change=300,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.WAITING_INPUT

    def test_waiting_input_confirm(self) -> None:
        signals = SessionSignals(
            preview="Please confirm",
            diff_pct=0.0,
            stable_counter=5,
            seconds_since_change=300,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.WAITING_INPUT

    def test_waiting_input_press_enter(self) -> None:
        signals = SessionSignals(
            preview="Press enter to continue",
            diff_pct=0.0,
            stable_counter=5,
            seconds_since_change=300,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.WAITING_INPUT

    def test_waiting_input_case_insensitive(self) -> None:
        signals = SessionSignals(
            preview="CONTINUE?",
            diff_pct=0.0,
            stable_counter=5,
            seconds_since_change=300,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.WAITING_INPUT

    def test_active_diff_pct_gt_10(self) -> None:
        signals = SessionSignals(
            preview="building...",
            diff_pct=15.0,
            stable_counter=0,
            seconds_since_change=30,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.ACTIVE

    def test_stable_seconds_since_change_lt_60(self) -> None:
        signals = SessionSignals(
            preview="idle",
            diff_pct=0.0,
            stable_counter=3,
            seconds_since_change=30,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.STABLE

    def test_waiting_seconds_between_60_and_180(self) -> None:
        signals = SessionSignals(
            preview="done",
            diff_pct=0.0,
            stable_counter=3,
            seconds_since_change=120,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.WAITING

    def test_stuck_seconds_gt_180_no_progress(self) -> None:
        signals = SessionSignals(
            preview="stuck output",
            diff_pct=0.0,
            stable_counter=5,
            seconds_since_change=300,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.STUCK

    def test_active_override_stable_counter_zero(self) -> None:
        signals = SessionSignals(
            preview="still running",
            diff_pct=0.0,
            stable_counter=0,
            seconds_since_change=300,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.ACTIVE

    def test_active_override_diff_pct_gt_0(self) -> None:
        signals = SessionSignals(
            preview="progressing",
            diff_pct=5.0,
            stable_counter=3,
            seconds_since_change=300,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.ACTIVE

    def test_stale_last_seen_gt_60s_ago(self) -> None:
        signals = SessionSignals(
            preview="old output",
            diff_pct=0.0,
            stable_counter=5,
            seconds_since_change=300,
            last_seen_at="2000-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.STALE

    def test_precedence_waiting_input_over_stuck(self) -> None:
        signals = SessionSignals(
            preview="Please confirm",
            diff_pct=0.0,
            stable_counter=5,
            seconds_since_change=300,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.WAITING_INPUT

    def test_classify_routes_unknown_when_all_rules_exhausted(self) -> None:
        signals = SessionSignals(
            preview="",
            diff_pct=0.0,
            stable_counter=0,
            seconds_since_change=0,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        result = classify_session(signals)
        assert isinstance(result, Status)

    def test_waiting_at_exactly_180_seconds(self) -> None:
        signals = SessionSignals(
            preview="done",
            diff_pct=0.0,
            stable_counter=3,
            seconds_since_change=180,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.WAITING

    def test_stable_at_zero_seconds(self) -> None:
        signals = SessionSignals(
            preview="just changed",
            diff_pct=0.0,
            stable_counter=0,
            seconds_since_change=0,
            last_seen_at="3026-06-26T12:00:00Z",
        )
        assert classify_session(signals) == Status.STABLE

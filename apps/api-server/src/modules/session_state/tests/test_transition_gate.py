from __future__ import annotations

import pytest

from modules.session_state.application.transition_gate import (
    should_assess_status,
    should_assess_transition,
)


class TestShouldAssessStatus:
    def test_stuck_is_eligible(self) -> None:
        assert should_assess_status("stuck") is True

    def test_waiting_is_eligible(self) -> None:
        assert should_assess_status("waiting") is True

    def test_waiting_input_is_eligible(self) -> None:
        assert should_assess_status("waiting_input") is True

    def test_active_not_eligible(self) -> None:
        assert should_assess_status("active") is False

    def test_stable_not_eligible(self) -> None:
        assert should_assess_status("stable") is False

    def test_unknown_not_eligible(self) -> None:
        assert should_assess_status("unknown") is False

    def test_stale_not_eligible(self) -> None:
        assert should_assess_status("stale") is False

    def test_empty_string_not_eligible(self) -> None:
        assert should_assess_status("") is False


class TestShouldAssessTransition:
    def test_transition_from_unknown_to_stuck_triggers(self) -> None:
        assert should_assess_transition("unknown", "stuck") is True

    def test_transition_from_unknown_to_waiting_triggers(self) -> None:
        assert should_assess_transition("unknown", "waiting") is True

    def test_transition_from_unknown_to_waiting_input_triggers(self) -> None:
        assert should_assess_transition("unknown", "waiting_input") is True

    def test_transition_from_active_to_stuck_triggers(self) -> None:
        assert should_assess_transition("active", "stuck") is True

    def test_transition_from_stable_to_waiting_triggers(self) -> None:
        assert should_assess_transition("stable", "waiting") is True

    def test_no_previous_status_stuck_does_not_trigger(self) -> None:
        assert should_assess_transition(None, "stuck") is False

    def test_same_status_stuck_does_not_trigger(self) -> None:
        assert should_assess_transition("stuck", "stuck") is False

    def test_same_status_waiting_does_not_trigger(self) -> None:
        assert should_assess_transition("waiting", "waiting") is False

    def test_transition_into_active_does_not_trigger(self) -> None:
        assert should_assess_transition("stuck", "active") is False

    def test_transition_into_stable_does_not_trigger(self) -> None:
        assert should_assess_transition("stuck", "stable") is False

    def test_transition_out_of_stuck_does_not_trigger(self) -> None:
        assert should_assess_transition("stuck", "active") is False

    def test_transition_into_unknown_does_not_trigger(self) -> None:
        assert should_assess_transition("stuck", "unknown") is False

    def test_transition_from_stuck_to_waiting_does_trigger(self) -> None:
        assert should_assess_transition("stuck", "waiting") is True

    def test_transition_from_waiting_to_stuck_does_trigger(self) -> None:
        assert should_assess_transition("waiting", "stuck") is True

    def test_transition_from_none_to_active_not_eligible(self) -> None:
        assert should_assess_transition(None, "active") is False

from __future__ import annotations

from modules.command_router.domain.command import CommandState


class InvalidTransitionError(ValueError):
    pass


TRANSITIONS: dict[CommandState, set[CommandState]] = {
    CommandState.accepted: {CommandState.delivered, CommandState.failed},
    CommandState.delivered: set(),
    CommandState.failed: set(),
}


def transition_allowed(current: CommandState, target: CommandState) -> bool:
    return target in TRANSITIONS.get(current, set())


class CommandStateMachine:
    @staticmethod
    def transition(current: CommandState, target: CommandState) -> CommandState:
        if target not in TRANSITIONS.get(current, set()):
            raise InvalidTransitionError(
                f"Cannot transition from {current.value} to {target.value}"
            )
        return target

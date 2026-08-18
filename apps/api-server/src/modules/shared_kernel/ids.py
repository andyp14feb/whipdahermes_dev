from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass(frozen=True, order=True)
class MachineId:
    value: str

    def __post_init__(self) -> None:
        if not self.value.strip():
            raise ValueError("MachineId must not be empty")

    def __str__(self) -> str:
        return self.value

    def __repr__(self) -> str:
        return f"MachineId({self.value!r})"

    @classmethod
    def generate(cls) -> MachineId:
        return cls(value=str(uuid.uuid4()))


@dataclass(frozen=True, order=True)
class SessionId:
    value: str

    def __post_init__(self) -> None:
        if not self.value.strip():
            raise ValueError("SessionId must not be empty")

    def __str__(self) -> str:
        return self.value

    def __repr__(self) -> str:
        return f"SessionId({self.value!r})"

    @classmethod
    def generate(cls) -> SessionId:
        return cls(value=str(uuid.uuid4()))


@dataclass(frozen=True, order=True)
class CommandId:
    value: str

    def __post_init__(self) -> None:
        if not self.value.strip():
            raise ValueError("CommandId must not be empty")

    def __str__(self) -> str:
        return self.value

    def __repr__(self) -> str:
        return f"CommandId({self.value!r})"

    @classmethod
    def generate(cls) -> CommandId:
        return cls(value=str(uuid.uuid4()))

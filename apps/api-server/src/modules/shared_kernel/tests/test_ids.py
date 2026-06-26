import pytest
from modules.shared_kernel.ids import MachineId, SessionId, CommandId


class TestMachineId:
    def test_creation(self) -> None:
        mid = MachineId("m-001")
        assert mid.value == "m-001"

    def test_equality(self) -> None:
        a = MachineId("m-001")
        b = MachineId("m-001")
        c = MachineId("m-002")
        assert a == b
        assert a != c

    def test_hash(self) -> None:
        s = {MachineId("m-001"), MachineId("m-001")}
        assert len(s) == 1

    def test_str(self) -> None:
        assert str(MachineId("abc")) == "abc"

    def test_repr(self) -> None:
        r = repr(MachineId("abc"))
        assert r == "MachineId('abc')"

    def test_immutability(self) -> None:
        mid = MachineId("m-001")
        with pytest.raises(AttributeError):
            mid.value = "changed"

    def test_empty_raises(self) -> None:
        with pytest.raises(ValueError, match="must not be empty"):
            MachineId("")

    def test_blank_raises(self) -> None:
        with pytest.raises(ValueError, match="must not be empty"):
            MachineId("   ")

    def test_type_safety(self) -> None:
        mid: MachineId = MachineId("m-001")
        sid: SessionId = SessionId("s-001")
        assert not isinstance(mid, SessionId)
        assert not isinstance(sid, MachineId)

    def test_generate(self) -> None:
        mid = MachineId.generate()
        assert len(mid.value) > 0


class TestSessionId:
    def test_creation(self) -> None:
        sid = SessionId("s-001")
        assert sid.value == "s-001"

    def test_equality(self) -> None:
        a = SessionId("s-001")
        b = SessionId("s-001")
        c = SessionId("s-002")
        assert a == b
        assert a != c

    def test_hash(self) -> None:
        s = {SessionId("s-001"), SessionId("s-001")}
        assert len(s) == 1

    def test_str(self) -> None:
        assert str(SessionId("xyz")) == "xyz"

    def test_repr(self) -> None:
        assert repr(SessionId("xyz")) == "SessionId('xyz')"

    def test_empty_raises(self) -> None:
        with pytest.raises(ValueError, match="must not be empty"):
            SessionId("")

    def test_generate(self) -> None:
        sid = SessionId.generate()
        assert len(sid.value) > 0


class TestCommandId:
    def test_creation(self) -> None:
        cid = CommandId("c-001")
        assert cid.value == "c-001"

    def test_equality(self) -> None:
        a = CommandId("c-001")
        b = CommandId("c-001")
        c = CommandId("c-002")
        assert a == b
        assert a != c

    def test_hash(self) -> None:
        s = {CommandId("c-001"), CommandId("c-001")}
        assert len(s) == 1

    def test_str(self) -> None:
        assert str(CommandId("cmd")) == "cmd"

    def test_repr(self) -> None:
        assert repr(CommandId("cmd")) == "CommandId('cmd')"

    def test_empty_raises(self) -> None:
        with pytest.raises(ValueError, match="must not be empty"):
            CommandId("")

    def test_generate(self) -> None:
        cid = CommandId.generate()
        assert len(cid.value) > 0

from modules.shared_kernel.error_envelope import APIError, ErrorEnvelope


class TestAPIError:
    def test_default_status_code(self) -> None:
        err = APIError(code="ERR", message="Something went wrong")
        assert err.status_code == 400

    def test_custom_status_code(self) -> None:
        err = APIError(
            code="NOT_FOUND",
            message="Not found",
            status_code=404,
        )
        assert err.status_code == 404

    def test_details(self) -> None:
        err = APIError(
            code="VAL_ERR",
            message="Validation failed",
            details={"field": "name"},
        )
        assert err.details == {"field": "name"}

    def test_str(self) -> None:
        err = APIError(code="ERR", message="msg")
        assert str(err) == "msg"


class TestErrorEnvelope:
    def test_from_error_basic(self) -> None:
        err = APIError(code="ERR_001", message="Bad request")
        result = ErrorEnvelope.from_error(err)
        assert result == {"error": {"code": "ERR_001", "message": "Bad request", "details": None}}

    def test_from_error_with_details(self) -> None:
        err = APIError(
            code="VAL_ERR",
            message="Invalid input",
            details={"field": "email", "reason": "format"},
        )
        result = ErrorEnvelope.from_error(err)
        assert result["error"]["code"] == "VAL_ERR"
        assert result["error"]["details"]["field"] == "email"

    def test_from_error_none_details_key(self) -> None:
        err = APIError(code="ERR", message="msg")
        result = ErrorEnvelope.from_error(err)
        assert result["error"]["details"] is None

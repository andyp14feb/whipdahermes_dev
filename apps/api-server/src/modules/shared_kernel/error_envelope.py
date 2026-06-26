from __future__ import annotations

from typing import Any


class APIError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        details: Any = None,
        status_code: int = 400,
    ) -> None:
        self.code = code
        self.message = message
        self.details = details
        self.status_code = status_code
        super().__init__(message)


class ErrorEnvelope:
    @staticmethod
    def from_error(err: APIError) -> dict[str, dict[str, Any]]:
        return {
            "error": {
                "code": err.code,
                "message": err.message,
                "details": err.details,
            }
        }

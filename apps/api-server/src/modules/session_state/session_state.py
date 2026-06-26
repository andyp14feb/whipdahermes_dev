from __future__ import annotations

from modules.session_state.adapters.persistence.session_repo import (
    SQLSessionRepo,
    create_session_engine,
)
from modules.session_state.application.ports import IDetectionClassifier
from modules.session_state.application.session_service import SessionService


def create_session_state_module(
    repo: SQLSessionRepo | None = None,
    classifier: IDetectionClassifier | None = None,
) -> SessionService:
    if repo is None:
        engine = create_session_engine()
        repo = SQLSessionRepo(engine)
    return SessionService(repo, classifier)

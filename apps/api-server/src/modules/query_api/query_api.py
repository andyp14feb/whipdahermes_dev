from __future__ import annotations

from fastapi import APIRouter

from modules.query_api.adapters.http.machines_router import create_machines_router
from modules.query_api.adapters.http.session_detail_router import (
    create_session_detail_router,
)
from modules.query_api.adapters.http.sessions_router import create_sessions_router
from modules.query_api.application.query_service import QueryService


def create_query_api_router(service: QueryService) -> APIRouter:
    router = APIRouter()
    router.include_router(create_machines_router(service))
    router.include_router(create_sessions_router(service))
    router.include_router(create_session_detail_router(service))
    return router

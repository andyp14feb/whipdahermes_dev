from __future__ import annotations

from fastapi import APIRouter

from modules.command_router.adapters.http.command_router import create_command_router
from modules.command_router.adapters.persistence.command_repo import (
    SQLCommandRepo,
    create_command_engine,
)
from modules.command_router.application.command_service import CommandService


def create_command_repo(database_url: str = "sqlite:///./whipai.db", **engine_kwargs) -> SQLCommandRepo:
    engine = create_command_engine(database_url, **engine_kwargs)
    return SQLCommandRepo(engine)


def create_command_router_module(service: CommandService) -> APIRouter:
    return create_command_router(service)

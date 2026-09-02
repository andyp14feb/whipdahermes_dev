from __future__ import annotations

import socket
from typing import Any

from fastapi import APIRouter


def _candidate_urls(port: int, scheme: str = "http") -> list[str]:
    """Return connection URLs the dashboard can pre-fill the worker URL with.

    Order: TailScale DNS-style hostnames, local network IPs, then localhost.
    """
    urls: list[str] = []
    seen: set[str] = set()

    def add(host: str) -> None:
        if not host or host in seen:
            return
        seen.add(host)
        urls.append(f"{scheme}://{host}:{port}")

    # TailScale MagicDNS hostname (e.g. mybox.tailnet.ts.net)
    hostname = socket.gethostname()
    if hostname:
        add(hostname)
        for suffix in (".tailnet.ts.net", ".ts.net"):
            add(f"{hostname}{suffix}")

    # All non-loopback interface IPs (TailScale is typically 100.x)
    try:
        infos = socket.getaddrinfo(hostname, None)
        for info in infos:
            sockaddr = info[4]
            if len(sockaddr) < 1:
                continue
            ip = sockaddr[0]
            if not ip or ip.startswith("127.") or ":" in ip:
                continue
            add(ip)
    except socket.gaierror:
        pass

    # Last-resort: localhost
    add("localhost")

    return urls


def create_server_info_router(default_port: int) -> APIRouter:
    router = APIRouter(prefix="/server-info", tags=["server-info"])

    @router.get("")
    def get_server_info() -> dict[str, Any]:
        return {
            "hostname": socket.gethostname(),
            "port": default_port,
            "candidateUrls": _candidate_urls(default_port),
        }

    return router

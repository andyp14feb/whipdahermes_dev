#!/usr/bin/env bash
set -euo pipefail

docker compose up -d --build
curl -fsS http://localhost:8000/health
curl -fsS http://localhost:3000 >/dev/null

docker compose down

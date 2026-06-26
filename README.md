# whipdahermes_dev

Monorepo for the WhipAI system — a multi-machine tmux session monitor and command router.

## Structure

```
whipdahermes_dev/
  apps/
    api-server/          FastAPI modular-monolith backend (Python 3.12+)
    web-dashboard/       React SPA frontend (Vite 8, TypeScript 5)
    machine-agent/       tmux capture agent (standalone Python)
  packages/
    contracts/           Shared API schemas / Pydantic models
    test-fixtures/       Shared test data and factories
  tests/
    e2e/                 End-to-end tests
```

## Quick Start

### API Server

```bash
cd apps/api-server
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn src.main:app --reload
```

### Web Dashboard

```bash
cd apps/web-dashboard
npm install
npm run dev
```

### Machine Agent

```bash
cd apps/machine-agent
export API_URL=http://localhost:8000
export MACHINE_ID=agent-01
python3 src/main.py
```

## Stack

| Component      | Version               |
|----------------|-----------------------|
| Python         | 3.12+                 |
| FastAPI        | 0.138.0               |
| Pydantic       | 2.13.4                |
| Uvicorn        | 0.49.0                |
| SQLModel       | 0.0.38                |
| React          | 19.x                  |
| TypeScript     | 5.x                   |
| Vite           | 8.1.0                 |
| Tailwind CSS   | 4.x                   |
| TanStack Query | 5.x                   |
| Zustand        | 5.x                   |

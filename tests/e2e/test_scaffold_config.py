"""Story 1.1 — Scaffold configuration validation.

Validates package metadata, dependency pins, and file contents defined by the story.
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
API_PYPROJECT = REPO / "apps" / "api-server" / "pyproject.toml"
WEB_PACKAGE = REPO / "apps" / "web-dashboard" / "package.json"
API_MAIN = REPO / "apps" / "api-server" / "src" / "main.py"
MACHINE_MAIN = REPO / "apps" / "machine-agent" / "src" / "main.py"
README = REPO / "README.md"
ENV_EXAMPLE = REPO / ".env.example"
PYTHON_VERSION = REPO / ".python-version"


def test_api_pyproject_contains_required_versions():
    content = API_PYPROJECT.read_text()
    assert 'requires-python = ">=3.12"' in content
    assert '"fastapi==0.138.0"' in content
    assert '"pydantic==2.13.4"' in content
    assert '"uvicorn[standard]==0.49.0"' in content
    assert '"sqlmodel==0.0.38"' in content
    assert 'dev = ["httpx"]' in content


def test_web_package_contains_required_dependencies():
    pkg = json.loads(WEB_PACKAGE.read_text())
    deps = pkg["dependencies"]
    dev_deps = pkg["devDependencies"]

    assert deps["react"].startswith("^19")
    assert deps["react-dom"].startswith("^19")
    assert "@tanstack/react-query" in deps
    assert "zustand" in deps
    assert "tailwindcss" in deps
    assert dev_deps["typescript"].startswith("^5")
    assert dev_deps["vite"] == "^8.1.0"


def test_api_main_exposes_health_endpoint_and_uvicorn_entrypoint():
    content = API_MAIN.read_text()
    assert '@app.get("/health")' in content
    assert 'return {"status": "ok"}' in content
    assert 'uvicorn.run(app' in content


def test_machine_agent_main_uses_env_config_and_heartbeat_url():
    content = MACHINE_MAIN.read_text()
    assert 'MACHINE_ID = os.getenv("MACHINE_ID", "")' in content
    assert 'API_URL = os.getenv("API_URL", "")' in content
    assert 'return f"{API_URL.rstrip(\'/\')}/heartbeat"' in content


def test_readme_describes_monorepo_structure_and_startup():
    content = README.read_text().lower()
    assert "whipai" in content
    assert "api-server" in content
    assert "web-dashboard" in content
    assert "machine-agent" in content
    assert "packages" in content


def test_env_example_contains_required_variables():
    content = ENV_EXAMPLE.read_text()
    assert "API_URL=" in content
    assert "MACHINE_ID=" in content
    assert "INTERVAL=" in content


def test_python_version_pin_is_312():
    assert PYTHON_VERSION.read_text().strip() == "3.12"

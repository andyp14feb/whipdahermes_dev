"""Story 1.1 — Smoke validation for scaffolded apps."""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
API_VENV_PYTHON = REPO / "apps" / "api-server" / ".venv" / "bin" / "python"
API_MAIN_DIR = REPO / "apps" / "api-server" / "src"
MACHINE_MAIN = REPO / "apps" / "machine-agent" / "src" / "main.py"
WEB_DIR = REPO / "apps" / "web-dashboard"


def test_api_dependency_versions_are_installed():
    result = subprocess.run(
        [
            str(API_VENV_PYTHON),
            "-c",
            "import fastapi, pydantic, uvicorn, sqlmodel; print(fastapi.__version__, pydantic.__version__, uvicorn.__version__, sqlmodel.__version__)",
        ],
        cwd=API_MAIN_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    output = result.stdout.strip()
    assert "0.138.0" in output
    assert "2.13.4" in output
    assert "0.49.0" in output
    assert "0.0.38" in output


def test_machine_agent_exits_with_config_message_when_env_missing():
    result = subprocess.run(
        [sys.executable, str(MACHINE_MAIN)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert "MACHINE_ID and API_URL must be set" in result.stderr


def test_web_dashboard_build_succeeds():
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    result = subprocess.run(
        [npm, "run", "build"],
        cwd=WEB_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(result.stdout + "\n" + result.stderr)
    assert "vite build" in result.stdout or "built in" in result.stdout.lower()

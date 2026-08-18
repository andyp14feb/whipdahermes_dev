"""Story 1.1 — Scaffold structure validation.

Verifies that all required directories and files exist after the scaffold script runs.
"""
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
APPS = REPO / "apps"
PACKAGES = REPO / "packages"
TESTS = REPO / "tests"


def test_required_directories_exist():
    """All required directories must be present after scaffolding."""
    required_dirs = [
        APPS / "api-server" / "src" / "modules",
        APPS / "web-dashboard" / "src",
        APPS / "machine-agent" / "src",
        PACKAGES / "contracts",
        PACKAGES / "test-fixtures",
        TESTS / "e2e",
    ]
    for d in required_dirs:
        assert d.exists(), f"Missing directory: {d.relative_to(REPO)}"


def test_api_server_module_subdirs():
    """Each backend bounded module directory must exist."""
    modules = APPS / "api-server" / "src" / "modules"
    expected = [
        "ingest",
        "machine_registry",
        "session_state",
        "detection",
        "command_router",
        "query_api",
        "auth_guard",
        "shared_kernel",
    ]
    for name in expected:
        mod_dir = modules / name
        assert mod_dir.exists(), f"Missing module directory: modules/{name}"


def test_root_config_files_exist():
    """Root config files required by the scaffold."""
    required_files = [
        REPO / "README.md",
        REPO / ".gitignore",
        REPO / ".python-version",
        REPO / ".env.example",
    ]
    for f in required_files:
        assert f.exists(), f"Missing root file: {f.name}"


def test_api_server_main_exists():
    """Backend entry point must exist."""
    main = APPS / "api-server" / "src" / "main.py"
    assert main.exists(), "apps/api-server/src/main.py is missing"


def test_machine_agent_main_exists():
    """Machine agent entry point must exist."""
    main = APPS / "machine-agent" / "src" / "main.py"
    assert main.exists(), "apps/machine-agent/src/main.py is missing"


def test_web_dashboard_source_exists():
    """Frontend source files must exist."""
    assert (APPS / "web-dashboard" / "src" / "main.tsx").exists()
    assert (APPS / "web-dashboard" / "src" / "App.tsx").exists()
    assert (APPS / "web-dashboard" / "index.html").exists()

import os
import tempfile
from pathlib import Path

from modules.shared_kernel.config import Settings


class TestSettings:
    def test_default_values(self) -> None:
        settings = Settings()
        assert settings.app_name == "whipai-api"
        assert settings.debug is False

    def test_dotenv_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            env_file = Path(tmp) / ".env"
            env_file.write_text("APP_NAME=from-dotenv\nDEBUG=true\n")
            settings = Settings(_env_file=str(env_file))
            assert settings.app_name == "from-dotenv"
            assert settings.debug is True

    def test_env_override(self) -> None:
        os.environ["APP_NAME"] = "test-override"
        settings = Settings()
        assert settings.app_name == "test-override"
        del os.environ["APP_NAME"]

    def test_api_token_is_secret(self) -> None:
        os.environ["API_TOKEN"] = "super-secret-token"
        settings = Settings()
        assert settings.api_token.get_secret_value() == "super-secret-token"
        assert "super-secret-token" not in repr(settings.api_token)
        del os.environ["API_TOKEN"]

    def test_database_url_secret(self) -> None:
        os.environ["DATABASE_URL"] = "postgres://user:pass@localhost/db"
        settings = Settings()
        assert "postgres://" in settings.database_url.get_secret_value()
        del os.environ["DATABASE_URL"]

"""App settings, read from environment variables (or a local .env file)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # true = seeded data, no AI calls. Stays the default (DECISIONS.md #3).
    mock_mode: bool = True
    # Only set in Render or a local .env. Never committed.
    anthropic_api_key: str = ""


settings = Settings()

"""App settings, read from environment variables (or a local .env file). BACKEND_CONTRACT.md section 3."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # true = seeded data, no AI calls. Stays the default (DECISIONS.md #3).
    mock_mode: bool = True
    # Only set in Render or a local .env. Never committed.
    anthropic_api_key: str = ""
    ai_model: str = "claude-sonnet-5-5"
    # AI Coach (section 7f): requests per caller per minute, and per day in total, before a 429.
    coach_rate_per_min: int = 10
    coach_daily_cap: int = 300
    # Comma-separated extra CORS origins, e.g. "https://frontdoor-abc.vercel.app,https://example.com".
    # Kept as plain text so it can be typed into Render's dashboard without JSON.
    frontend_origins: str = ""

    @property
    def frontend_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.frontend_origins.split(",") if o.strip()]


settings = Settings()

import re
from urllib.parse import urlsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="RE_", env_file=".env", extra="ignore", hide_input_in_errors=True
    )
    environment: str = "development"
    database_url: str = Field(default="sqlite+aiosqlite:///./re-local.db", repr=False)
    demo_auth: bool = False
    supabase_url: str = ""
    jwt_audience: str = "authenticated"
    cors_origins: str = "http://localhost:8081,http://localhost:3000"
    elevenlabs_api_key: str = Field(default="", repr=False)
    elevenlabs_agent_id: str = ""
    provider_privacy_verified: bool = False
    provider_privacy_policy_version: str = ""
    exa_api_key: str = ""
    gemini_api_key: str = ""

    def model_post_init(self, context: object) -> None:
        if self.environment not in ("development", "production", "test"):
            raise ValueError("Unknown RE_ENVIRONMENT")
        if self.demo_auth and self.environment != "development":
            raise ValueError("Demo auth is restricted to development")
        if self.environment == "production":
            from sqlalchemy.engine import make_url

            from .database_url import postgres_dsn

            try:
                url = make_url(postgres_dsn(self.database_url))
                secure_db = url.query.get("sslmode") == "verify-full" and bool(
                    url.host and url.database and url.username and url.password
                )
            except Exception:  # noqa: BLE001 — never include a credential-bearing URL
                raise ValueError("Production requires a valid PostgreSQL URL") from None
            if not secure_db:
                raise ValueError(
                    "Production PostgreSQL requires credentials and sslmode=verify-full"
                )
            if (
                not self.supabase_url
                or not secure_origin(self.supabase_url)
                or not self.jwt_audience
            ):
                raise ValueError("Production requires HTTPS RE_SUPABASE_URL and RE_JWT_AUDIENCE")
            origins = self.cors_origins.split(",")
            if not origins or any(not secure_origin(o) for o in origins):
                raise ValueError("Production requires explicit HTTPS RE_CORS_ORIGINS")
            if not all(
                (
                    self.elevenlabs_api_key,
                    self.elevenlabs_agent_id,
                    self.provider_privacy_verified,
                    self.provider_privacy_policy_version,
                )
            ):
                raise ValueError(
                    "Production requires ElevenLabs credentials and reviewed provider privacy settings"
                )


def secure_origin(value: str) -> bool:
    url = urlsplit(value.strip())
    return bool(
        url.scheme == "https"
        and url.hostname
        and url.hostname not in ("localhost", "127.0.0.1", "::1")
        and "*" not in url.hostname
        and not url.username
        and not url.password
        and url.path in ("", "/")
        and not url.query
        and not url.fragment
    )

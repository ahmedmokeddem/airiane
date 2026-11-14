from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RE_", env_file=".env", extra="ignore")
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./re-local.db"
    demo_auth: bool = False
    supabase_url: str = ""
    jwt_audience: str = "authenticated"
    cors_origins: str = "http://localhost:8081,http://localhost:3000"
    elevenlabs_api_key: str = ""
    elevenlabs_agent_id: str = ""
    provider_privacy_verified: bool = False
    provider_privacy_policy_version: str = ""
    exa_api_key: str = ""
    gemini_api_key: str = ""

    def model_post_init(self, context: object) -> None:
        if self.demo_auth and self.environment != "development":
            raise ValueError("Demo auth is restricted to development")

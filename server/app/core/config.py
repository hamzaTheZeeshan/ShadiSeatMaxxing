from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    CORS_ORIGINS: str = "http://localhost:5173"
    ENV: str = "dev"
    SOLVER_DEFAULT_TIME_LIMIT_SECONDS: int = 10
    MAX_BODY_BYTES: int = 2_097_152

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
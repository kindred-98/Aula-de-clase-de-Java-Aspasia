"""Configuración de la aplicación mediante variables de entorno."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variables de entorno validadas. Los secretos nunca tienen default real."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AulaVirtual"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    debug: bool = False

    secret_key: str = Field(
        default="dev-only-insecure-secret-change-me-32chars",
        min_length=16,
    )
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 14
    algorithm: str = "HS256"

    cors_origins: str = "http://localhost:5173"

    database_url: str = "postgresql+psycopg://aula:aula@localhost:5432/aula"
    testing_database_url: str = "sqlite:///./test.db"

    storage_backend: str = "local"
    storage_local_path: str = "./uploads"
    s3_endpoint_url: str | None = None
    s3_bucket: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None

    max_upload_mb: int = 10

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _strip_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

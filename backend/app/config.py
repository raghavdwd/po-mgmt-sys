from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "PO Management System"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/po_mgmt"

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/callback/google"

    JWT_SECRET_KEY: str = "jwt-secret-change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    GEMINI_API_KEY: str = ""

    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "po_mgmt_ai_logs"

    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

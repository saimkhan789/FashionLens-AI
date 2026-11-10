from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # Local dev default matches the Docker container run.py starts.
    # In production point this at Neon/Supabase (any Postgres with pgvector).
    DATABASE_URL: str = "postgresql://fashionlens:fashionlens@localhost:5433/fashionlens"

    JWT_SECRET: str = "dev-only-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Comma-separated; these accounts get admin rights (store importer) on login.
    ADMIN_EMAILS: str = ""

    CORS_ORIGINS: str = "http://localhost:3000"

    # Google sign-in: OAuth "Web application" client ID from Google Cloud Console.
    # Leave empty to hide the Google button.
    GOOGLE_CLIENT_ID: str = ""

    # Free searches before sign-in is required (per browser, lifetime).
    GUEST_TEXT_SEARCHES: int = 3
    GUEST_IMAGE_SEARCHES: int = 1
    # Looser per-IP cap per 24h, so clearing cookies / incognito can't bypass the limit
    # forever, while people sharing a mobile-carrier IP aren't blocked by each other.
    GUEST_IP_TEXT_PER_DAY: int = 30
    GUEST_IP_IMAGE_PER_DAY: int = 10
    # Number of reverse proxies in front of the app (Hugging Face Spaces: 1). Used to
    # read the real client IP from X-Forwarded-For; 0 trusts the direct connection only.
    PROXY_HOPS: int = 0
    # Production only: send the guest cookie over HTTPS only.
    SECURE_COOKIES: bool = False

    # Added to outbound product links so brands can see the traffic in their analytics.
    UTM_SOURCE: str = "fashionlens"

    EMBED_MODEL: str = "hf-hub:Marqo/marqo-fashionSigLIP"
    DETECT_MODEL: str = "valentinafeve/yolos-fashionpedia"
    # Set to false to boot the API without loading the AI models (e.g. quick UI work).
    LOAD_MODELS: bool = True

    FRONTEND_DIR: Path = ROOT_DIR / "frontend" / "out"

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+asyncpg://" + url[len(prefix):]
        return url

    @property
    def admin_emails(self) -> set[str]:
        return {e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()}


settings = Settings()

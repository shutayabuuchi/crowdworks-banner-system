import os
from dotenv import load_dotenv

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
if SUPABASE_URL.endswith("/rest/v1"):
    SUPABASE_URL = SUPABASE_URL[: -len("/rest/v1")]
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CROWDWORKS_COOKIE = os.getenv("CROWDWORKS_COOKIE", "")
APP_HOST = os.getenv("APP_HOST", "0.0.0.0")

def _int_env(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default

APP_PORT = _int_env("APP_PORT", 8000)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",")
    if origin.strip()
]

CROWDWORKS_BASE_URL = "https://crowdworks.jp"
CROWDWORKS_SEARCH_URL = "https://crowdworks.jp/public/jobs/search"
BANNER_CATEGORY_PARAMS = {
    "category_id": "18",
    "payment_type": "competition",
    "order": "new",
    "keep_search_criteria": "true",
}
SCRAPE_INTERVAL_SECONDS = _int_env("SCRAPE_INTERVAL_SECONDS", 0)

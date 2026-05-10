from __future__ import annotations
import base64
import time
import uuid
import httpx
from openai import OpenAI
from backend.config import OPENAI_API_KEY
from backend.db.supabase_client import save_banner, upload_file_to_storage

openai_client = OpenAI(api_key=OPENAI_API_KEY)

# gpt-image-1 supports: 1024x1024 | 1536x1024 (landscape) | 1024x1536 (portrait)
SIZE_MAP = {
    "1200x628":  "1536x1024",
    "1200x630":  "1536x1024",
    "1920x600":  "1536x1024",
    "728x90":    "1536x1024",
    "300x250":   "1024x1024",
    "300x600":   "1024x1536",
    "160x600":   "1024x1536",
    "default":   "1536x1024",
}


def _get_image_size(banner_size: str) -> str:
    return SIZE_MAP.get(banner_size, SIZE_MAP["default"])


def _fetch_image_bytes(item) -> bytes:
    """Extract image bytes from an API response item (b64_json or url)."""
    if getattr(item, "b64_json", None):
        return base64.b64decode(item.b64_json)
    if getattr(item, "url", None):
        resp = httpx.get(item.url, timeout=60)
        resp.raise_for_status()
        return resp.content
    raise RuntimeError("API response contained neither b64_json nor url")


def generate_banner(prompt: dict, banner_size: str = "1200x628") -> dict:
    """Generate a banner image using gpt-image-1 and store in Supabase."""
    image_size = _get_image_size(banner_size)

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = openai_client.images.generate(
                model="gpt-image-1",
                prompt=prompt["text_prompt"][:4000],
                size=image_size,
                quality="high",
                n=1,
            )

            if not response.data:
                raise RuntimeError("API returned empty image list")

            img_data = _fetch_image_bytes(response.data[0])

            banner_id = f"BN{str(uuid.uuid4())[:8].upper()}"
            path = f"{prompt['job_id']}/{banner_id}.png"
            storage_url = upload_file_to_storage("banners", path, img_data, "image/png")

            banner = {
                "job_id": prompt["job_id"],
                "banner_id": banner_id,
                "prompt_id": prompt["prompt_id"],
                "image_url": storage_url,
                "design_taste": prompt["design_taste"],
                "status": "generated",
            }
            save_banner(banner)
            return banner

        except Exception as e:
            last_error = e
            print(f"[BannerGen] Attempt {attempt + 1} failed: {type(e).__name__}: {e}")
            if attempt < 2:
                time.sleep(2 ** attempt)  # 1s then 2s before retrying

    raise RuntimeError(f"Banner generation failed: {type(last_error).__name__}: {last_error}")


def generate_banners_for_job(job_id: str, prompts: list, banner_size: str = "1200x628") -> list:
    """Generate banners for all prompts of a job."""
    banners = []
    for prompt in prompts:
        try:
            banner = generate_banner(prompt, banner_size)
            banners.append(banner)
        except Exception as e:
            print(f"[BannerGen] Failed for prompt {prompt['prompt_id']}: {e}")
    return banners

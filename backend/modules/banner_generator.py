from __future__ import annotations
import base64
import uuid
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


def generate_banner(prompt: dict, banner_size: str = "1200x628") -> dict:
    """Generate a banner image using gpt-image-1 and store in Supabase."""
    image_size = _get_image_size(banner_size)

    for attempt in range(3):
        try:
            response = openai_client.images.generate(
                model="gpt-image-1",
                prompt=prompt["text_prompt"][:4000],
                size=image_size,
                quality="high",
                n=1,
            )

            # gpt-image-1 returns base64-encoded image data
            b64_data = response.data[0].b64_json
            img_data = base64.b64decode(b64_data)

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
            print(f"[BannerGen] Attempt {attempt + 1} failed: {e}")
            if attempt == 2:
                raise RuntimeError(f"Banner generation failed after 3 attempts: {e}")

    raise RuntimeError("Banner generation failed")


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

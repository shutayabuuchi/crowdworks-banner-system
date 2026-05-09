from __future__ import annotations
import uuid
import httpx
from openai import OpenAI
from backend.config import OPENAI_API_KEY
from backend.db.supabase_client import save_banner, upload_file_to_storage

openai_client = OpenAI(api_key=OPENAI_API_KEY)

SIZE_MAP = {
    "1200x628": "1792x1024",
    "1200x630": "1792x1024",
    "728x90": "1792x1024",
    "300x250": "1024x1024",
    "300x600": "1024x1792",
    "160x600": "1024x1792",
    "default": "1792x1024",
}


def _get_dalle_size(banner_size: str) -> str:
    return SIZE_MAP.get(banner_size, SIZE_MAP["default"])


def generate_banner(prompt: dict, banner_size: str = "1200x628") -> dict:
    """Generate a banner image using DALL-E 3 and store in Supabase."""
    dalle_size = _get_dalle_size(banner_size)

    for attempt in range(3):
        try:
            response = openai_client.images.generate(
                model="dall-e-3",
                prompt=prompt["text_prompt"][:4000],
                size=dalle_size,
                quality="standard",
                n=1,
            )
            image_url_temp = response.data[0].url

            # Download the image
            img_data = httpx.get(image_url_temp, timeout=30).content

            # Upload to Supabase storage
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

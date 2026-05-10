from __future__ import annotations
from typing import Optional
from supabase import create_client, Client
from backend.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def save_job(job: dict) -> dict:
    client = get_client()
    result = client.table("jobs").upsert(job).execute()
    return result.data[0] if result.data else {}


def save_jobs(jobs: list[dict]) -> list[dict]:
    if not jobs:
        return []
    client = get_client()
    result = client.table("jobs").upsert(jobs).execute()
    return result.data or []


def get_unprocessed_jobs() -> list:
    client = get_client()
    result = client.table("jobs").select("*").eq("processed", False).contains("requirements", ["コンペ形式"]).execute()
    return result.data or []


def get_job(job_id: str) -> Optional[dict]:
    client = get_client()
    result = client.table("jobs").select("*").eq("job_id", job_id).limit(1).execute()
    return result.data[0] if result.data else None


def mark_job_processed(job_id: str):
    client = get_client()
    client.table("jobs").update({"processed": True}).eq("job_id", job_id).execute()


def save_analyzed_job(analyzed: dict) -> dict:
    client = get_client()
    result = client.table("analyzed_jobs").upsert(analyzed).execute()
    return result.data[0] if result.data else {}


def get_analyzed_job(job_id: str) -> Optional[dict]:
    client = get_client()
    result = client.table("analyzed_jobs").select("*").eq("job_id", job_id).limit(1).execute()
    return result.data[0] if result.data else None


def save_prompt(prompt: dict) -> dict:
    client = get_client()
    result = client.table("prompts").insert(prompt).execute()
    return result.data[0] if result.data else {}


def delete_prompts_for_job(job_id: str):
    client = get_client()
    client.table("prompts").delete().eq("job_id", job_id).execute()


def get_prompts_for_job(job_id: str) -> list:
    client = get_client()
    result = client.table("prompts").select("*").eq("job_id", job_id).execute()
    return result.data or []


def save_banner(banner: dict) -> dict:
    client = get_client()
    result = client.table("banners").insert(banner).execute()
    return result.data[0] if result.data else {}


def get_banners_for_job(job_id: str) -> list:
    client = get_client()
    result = client.table("banners").select("*").eq("job_id", job_id).execute()
    return result.data or []


def update_banner_status(banner_id: str, status: str) -> dict:
    client = get_client()
    result = client.table("banners").update({"status": status}).eq("banner_id", banner_id).execute()
    return result.data[0] if result.data else {}


def save_application_text(app_text: dict) -> dict:
    client = get_client()
    result = client.table("application_texts").insert(app_text).execute()
    return result.data[0] if result.data else {}


def get_all_jobs_with_banners() -> list:
    """Get all jobs with their banner counts for dashboard."""
    client = get_client()
    result = client.table("jobs").select("*, banners(count)").contains("requirements", ["コンペ形式"]).execute()
    return result.data or []


def upload_file_to_storage(bucket: str, path: str, data: bytes, content_type: str) -> str:
    """Upload file to Supabase Storage and return public URL."""
    client = get_client()
    client.storage.from_(bucket).upload(path, data, {"content-type": content_type, "upsert": "true"})
    url = client.storage.from_(bucket).get_public_url(path)
    return url

from fastapi import APIRouter, HTTPException
from backend.modules.banner_generator import generate_banners_for_job
from backend.db.supabase_client import (
    get_analyzed_job, get_prompts_for_job, get_banners_for_job,
    update_banner_status, delete_banners_for_job,
)
from backend.models.schemas import BannerStatusUpdate

router = APIRouter(prefix="/banners", tags=["banners"])


@router.post("/generate")
async def generate_banners(request: dict):
    """Generate banners for a job. Expects {job_id} or a Prompt object."""
    job_id = request.get("job_id")
    if not job_id:
        raise HTTPException(status_code=400, detail="job_id required")

    analyzed = get_analyzed_job(job_id)
    if not analyzed:
        raise HTTPException(status_code=404, detail="Analyzed job not found. Run /jobs/{job_id}/analyze first.")

    prompts = get_prompts_for_job(job_id)
    if not prompts:
        raise HTTPException(status_code=404, detail="No prompts found. Run /prompts/generate first.")

    try:
        # Remove previous banners so regeneration always gives a clean result
        delete_banners_for_job(job_id)
        banners = generate_banners_for_job(job_id, prompts, analyzed.get("banner_size", "1200x628"))
        return banners
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}")
async def get_banners(job_id: str):
    return get_banners_for_job(job_id)


@router.patch("/{banner_id}/status")
async def update_status(banner_id: str, update: BannerStatusUpdate):
    if update.status not in ("approved", "rejected", "generated"):
        raise HTTPException(status_code=400, detail="Invalid status")
    return update_banner_status(banner_id, update.status)

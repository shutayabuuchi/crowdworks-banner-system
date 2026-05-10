from fastapi import APIRouter, HTTPException
from backend.modules.job_scraper import run_scraper
from backend.modules.job_analyzer import analyze_job
from backend.db.supabase_client import get_job, get_unprocessed_jobs, get_all_jobs_with_banners, mark_job_processed

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/scrape")
async def scrape_jobs():
    return run_scraper()


@router.get("/")
async def list_jobs():
    return get_all_jobs_with_banners()


@router.get("/unprocessed")
async def list_unprocessed():
    return get_unprocessed_jobs()


@router.get("/{job_id}")
async def get_job_detail(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/{job_id}/analyze")
async def analyze_job_endpoint(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        result = analyze_job(job_id)
        mark_job_processed(job_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

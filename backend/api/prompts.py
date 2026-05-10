from fastapi import APIRouter, HTTPException
from backend.modules.prompt_generator import generate_prompts
from backend.db.supabase_client import get_analyzed_job, get_prompts_for_job, update_prompt

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.post("/generate")
async def generate_prompts_endpoint(analyzed_job: dict):
    if "job_id" not in analyzed_job:
        raise HTTPException(status_code=400, detail="job_id required")
    try:
        return generate_prompts(analyzed_job)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}")
async def get_prompts(job_id: str):
    return get_prompts_for_job(job_id)


@router.put("/{prompt_id}")
async def update_prompt_endpoint(prompt_id: str, body: dict):
    text_prompt = body.get("text_prompt", "").strip()
    if not text_prompt:
        raise HTTPException(status_code=400, detail="text_prompt required")
    result = update_prompt(prompt_id, text_prompt)
    if not result:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return result

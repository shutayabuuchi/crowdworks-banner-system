from fastapi import APIRouter, HTTPException
from backend.modules.application_text_generator import generate_application_text

router = APIRouter(prefix="/application_texts", tags=["application_texts"])


@router.post("/generate")
async def generate_app_text(request: dict):
    required = ["job_id", "selected_banner_id", "job_details", "banner_details"]
    for field in required:
        if field not in request:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")
    try:
        return generate_application_text(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

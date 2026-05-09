from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class Attachment(BaseModel):
    file_name: str
    file_url: str
    file_type: str
    local_path: Optional[str] = None


class Job(BaseModel):
    job_id: str
    url: str
    title: str
    reward: str
    deadline: Optional[str] = None
    client_name: Optional[str] = None
    description: str
    requirements: List[str] = []
    attachments: List[Attachment] = []
    processed: bool = False


class DownloadedAsset(BaseModel):
    asset_name: str
    asset_type: str  # logo, image, guideline
    storage_url: str
    extracted_text: Optional[str] = None


class AnalyzedJob(BaseModel):
    job_id: str
    banner_size: str
    purpose: str
    target_audience: str
    key_phrases: List[str]
    logo_required: bool
    design_tastes: List[str]
    forbidden_elements: List[str] = []
    downloaded_assets: List[DownloadedAsset] = []


class Prompt(BaseModel):
    job_id: str
    prompt_id: str
    text_prompt: str
    design_taste: str
    gemini_input: str


class Banner(BaseModel):
    job_id: str
    banner_id: str
    prompt_id: str
    image_url: str
    design_taste: str
    status: str = "generated"


class ApplicationText(BaseModel):
    job_id: str
    application_id: str
    banner_id: str
    text_content: str
    generated_at: str


class GenerateApplicationTextRequest(BaseModel):
    job_id: str
    selected_banner_id: str
    job_details: dict
    banner_details: dict


class ScrapeResponse(BaseModel):
    message: str


class BannerStatusUpdate(BaseModel):
    status: str  # approved, rejected
    comment: Optional[str] = None

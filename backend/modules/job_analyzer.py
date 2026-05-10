import uuid
import json
import base64
import requests
import anthropic
from backend.config import ANTHROPIC_API_KEY
from backend.db.supabase_client import (
    get_job, save_analyzed_job, get_analyzed_job, upload_file_to_storage
)

claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

ANALYSIS_PROMPT = """あなたはバナー広告のデザイン専門家です。以下のクラウドワークスの案件情報を分析し、バナー制作に必要な情報をJSON形式で抽出してください。

案件情報:
タイトル: {title}
説明: {description}
報酬: {reward}
必要スキル: {requirements}

以下のJSON形式で回答してください（日本語で）:
{{
  "banner_size": "バナーサイズ（例: 300x250, 728x90, 1200x628）",
  "purpose": "バナーの目的（例: 商品購入促進, ブランド認知向上）",
  "target_audience": "ターゲット層（例: 20代女性, ビジネスパーソン）",
  "key_phrases": ["含めるべき主要文言1", "文言2"],
  "logo_required": true または false,
  "design_tastes": ["デザインテイスト1（例: モダン）", "テイスト2"],
  "forbidden_elements": ["禁止要素1", "禁止要素2"]
}}

注意: 案件に明示されていない場合は合理的な推測で補完してください。"""


def _as_text(value, default: str = "") -> str:
    if isinstance(value, list):
        return "、".join(str(item) for item in value if item)
    if value is None:
        return default
    return str(value)


def _banner_size(value) -> str:
    if isinstance(value, list):
        for item in value:
            text = str(item)
            if "x" in text or "×" in text:
                return text.replace("×", "x")
        return "1200x628"
    text = _as_text(value, "1200x628").replace("×", "x")
    return text or "1200x628"


def analyze_job(job_id: str) -> dict:
    """Analyze a job and return AnalyzedJob data."""
    job = get_job(job_id)
    if not job:
        raise ValueError(f"Job {job_id} not found")

    existing = get_analyzed_job(job_id)
    if existing:
        return existing

    prompt = ANALYSIS_PROMPT.format(
        title=job.get("title", ""),
        description=job.get("description", ""),
        reward=job.get("reward", ""),
        requirements=", ".join(job.get("requirements", [])),
    )

    response = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    # Extract JSON from response
    start = text.find("{")
    end = text.rfind("}") + 1
    analysis = json.loads(text[start:end])

    # Download attachments and upload to Supabase storage
    downloaded_assets = []
    for attachment in job.get("attachments", [])[:5]:
        asset = download_and_store_asset(attachment, job_id)
        if asset:
            downloaded_assets.append(asset)

    analyzed = {
        "job_id": job_id,
        "banner_size": _banner_size(analysis.get("banner_size", "1200x628")),
        "purpose": _as_text(analysis.get("purpose"), "商品・サービスのプロモーション"),
        "target_audience": _as_text(analysis.get("target_audience"), "一般ユーザー"),
        "key_phrases": analysis.get("key_phrases", []),
        "logo_required": analysis.get("logo_required", False),
        "design_tastes": analysis.get("design_tastes", ["モダン", "シンプル"]),
        "forbidden_elements": analysis.get("forbidden_elements", []),
        "downloaded_assets": downloaded_assets,
    }

    save_analyzed_job(analyzed)
    return analyzed


def download_and_store_asset(attachment: dict, job_id: str):
    """Download an attachment and upload to Supabase storage."""
    try:
        resp = requests.get(attachment["file_url"], timeout=15)
        resp.raise_for_status()
        data = resp.content
        file_name = attachment["file_name"]
        path = f"{job_id}/{file_name}"
        content_type = attachment.get("file_type", "application/octet-stream")
        url = upload_file_to_storage("assets", path, data, content_type)

        asset_type = "logo" if "logo" in file_name.lower() else \
                     "guideline" if "guide" in file_name.lower() or "pdf" in file_name.lower() else "image"

        extracted_text = None
        if content_type.startswith("image/"):
            extracted_text = extract_text_from_image(data, content_type)

        return {
            "asset_name": file_name,
            "asset_type": asset_type,
            "storage_url": url,
            "extracted_text": extracted_text,
        }
    except Exception as e:
        print(f"[Analyzer] Failed to download asset {attachment.get('file_name')}: {e}")
        return None


def extract_text_from_image(image_data: bytes, content_type: str):
    """Use Claude vision to extract text from image."""
    try:
        media_type = content_type if content_type in ["image/jpeg", "image/png", "image/gif", "image/webp"] else "image/jpeg"
        b64 = base64.standard_b64encode(image_data).decode("utf-8")
        response = claude.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": "この画像に含まれるテキストをすべて抽出してください。テキストがなければ「なし」と答えてください。"},
                ],
            }],
        )
        return response.content[0].text.strip()
    except Exception as e:
        print(f"[Analyzer] OCR failed: {e}")
        return None

import uuid
import json
import base64
import requests
import anthropic
from backend.config import ANTHROPIC_API_KEY
from backend.db.supabase_client import get_job, save_analyzed_job, upload_file_to_storage

claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

ANALYSIS_PROMPT = """あなたはバナー広告・グラフィックデザインの専門家です。
以下のクラウドワークス案件を**原文のまま正確に**読み取り、制作物の仕様をJSONで返してください。

案件情報:
タイトル: {title}
説明:
{description}
報酬: {reward}
必要スキル: {requirements}

【抽出ルール】
- 案件に明示されている内容は必ずそのまま反映する
- 明示がない項目は合理的に推測し、その旨を値に含める
- 商品名・サービス名・キャッチコピー・会社名が本文にあれば必ず key_phrases に含める
- サイズは「300x250」「1200×628」など本文記載のものを優先する
- 制作物の種類（バナー/ロゴ/チラシ/LP/SNS投稿画像 等）を deliverable に明記する

以下のJSON形式のみ返してください（説明文不要）:
{{
  "deliverable": "制作物の種類（例: Webバナー, SNS投稿画像, チラシ, ロゴ）",
  "banner_size": "サイズ（例: 1200x628, 複数の場合はカンマ区切り）",
  "purpose": "制作物の目的（案件本文から抽出）",
  "target_audience": "ターゲット層（案件本文から抽出）",
  "product_or_service": "掲載する商品・サービス名（案件本文から抽出、不明なら空文字）",
  "brand_colors": ["指定カラー1（例: #FF0000）", "指定カラー2"],
  "key_phrases": ["必ず含めるテキスト・キャッチコピー1", "文言2"],
  "visual_elements": ["含めるべき視覚要素1（例: 笑顔の女性モデル）", "要素2"],
  "logo_required": true または false,
  "style_notes": "デザインの方向性・禁止事項・参考サイト等（案件本文から抽出）",
  "forbidden_elements": ["禁止要素1", "禁止要素2"]
}}"""


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
        "deliverable": _as_text(analysis.get("deliverable"), "Webバナー"),
        "banner_size": _banner_size(analysis.get("banner_size", "1200x628")),
        "purpose": _as_text(analysis.get("purpose"), "商品・サービスのプロモーション"),
        "target_audience": _as_text(analysis.get("target_audience"), "一般ユーザー"),
        "product_or_service": _as_text(analysis.get("product_or_service"), ""),
        "brand_colors": analysis.get("brand_colors", []),
        "key_phrases": analysis.get("key_phrases", []),
        "visual_elements": analysis.get("visual_elements", []),
        "logo_required": analysis.get("logo_required", False),
        "style_notes": _as_text(analysis.get("style_notes"), ""),
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

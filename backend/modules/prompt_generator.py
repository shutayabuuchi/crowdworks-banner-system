from __future__ import annotations
import uuid
import google.generativeai as genai
from backend.config import GEMINI_API_KEY
from backend.db.supabase_client import save_prompt, get_prompts_for_job

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")

DESIGN_TASTES = ["モダン", "ポップ", "エレガント"]

GEMINI_PROMPT_TEMPLATE = """あなたはプロのバナーデザイナーです。以下の案件情報をもとに、DALL-E 3で使用するバナー生成用の英語プロンプトを作成してください。

案件情報:
- バナーサイズ: {banner_size}
- 目的: {purpose}
- ターゲット層: {target_audience}
- 含めるべき文言: {key_phrases}
- デザインテイスト: {design_taste}
- ロゴ必要: {logo_required}
- 禁止要素: {forbidden_elements}

要件:
1. プロンプトは英語で200〜300語
2. 具体的な視覚的要素（色、レイアウト、フォントスタイル）を含める
3. {design_taste}のテイストを強調
4. 商業バナー広告として適切なクオリティを指定
5. "banner advertisement" で始める

英語プロンプトのみを返してください。"""


def _as_text(value, default: str = "") -> str:
    if isinstance(value, list):
        return "、".join(str(item) for item in value if item)
    if value is None:
        return default
    return str(value)


def generate_prompts(analyzed_job: dict) -> list:
    """Generate multiple prompts for different design tastes."""
    job_id = analyzed_job["job_id"]

    existing = get_prompts_for_job(job_id)
    if existing:
        return existing

    prompts = []
    for taste in DESIGN_TASTES:
        gemini_input = GEMINI_PROMPT_TEMPLATE.format(
            banner_size=_as_text(analyzed_job.get("banner_size"), "1200x628"),
            purpose=_as_text(analyzed_job.get("purpose")),
            target_audience=_as_text(analyzed_job.get("target_audience")),
            key_phrases=", ".join(analyzed_job.get("key_phrases", [])),
            design_taste=taste,
            logo_required="はい" if analyzed_job.get("logo_required") else "いいえ",
            forbidden_elements=", ".join(analyzed_job.get("forbidden_elements", [])) or "なし",
        )

        try:
            response = model.generate_content(gemini_input)
            text_prompt = response.text.strip()
        except Exception as e:
            print(f"[PromptGen] Gemini error for taste {taste}: {e}")
            text_prompt = _fallback_prompt(analyzed_job, taste)

        prompt = {
            "job_id": job_id,
            "prompt_id": f"PR{str(uuid.uuid4())[:8].upper()}",
            "text_prompt": text_prompt,
            "design_taste": taste,
            "gemini_input": gemini_input,
        }
        save_prompt(prompt)
        prompts.append(prompt)

    return prompts


def _fallback_prompt(analyzed_job: dict, taste: str) -> str:
    size = _as_text(analyzed_job.get("banner_size"), "1200x628")
    purpose = _as_text(analyzed_job.get("purpose"), "product promotion")
    target = _as_text(analyzed_job.get("target_audience"), "general audience")
    phrases = ", ".join(analyzed_job.get("key_phrases", []))
    taste_map = {
        "モダン": "modern, minimalist, clean lines, professional",
        "ポップ": "vibrant, colorful, playful, energetic, fun",
        "エレガント": "elegant, luxurious, sophisticated, refined",
    }
    style = taste_map.get(taste, "modern, professional")
    return (
        f"banner advertisement, {size} pixels, {style} design, "
        f"for {purpose}, targeting {target}, "
        f"text elements: '{phrases}', "
        f"high quality commercial banner, professional graphic design, "
        f"sharp typography, balanced composition, marketing material"
    )

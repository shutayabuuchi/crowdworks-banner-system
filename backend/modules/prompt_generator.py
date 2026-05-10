from __future__ import annotations
import uuid
import google.generativeai as genai
from backend.config import GEMINI_API_KEY
from backend.db.supabase_client import delete_prompts_for_job, get_job, save_prompt

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")

DESIGN_TASTES = ["モダン", "ポップ", "エレガント"]

GEMINI_PROMPT_TEMPLATE = """あなたはプロのグラフィックデザイナーです。以下のクラウドワークス案件本文を最優先で読み取り、DALL-E 3で使用する画像生成用の英語プロンプトを作成してください。

案件原文:
- タイトル: {job_title}
- 報酬: {job_reward}
- クライアント: {client_name}
- 本文:
{job_description}

分析情報:
- バナーサイズ: {banner_size}
- 目的: {purpose}
- ターゲット層: {target_audience}
- 含めるべき文言: {key_phrases}
- デザインテイスト: {design_taste}
- ロゴ必要: {logo_required}
- 禁止要素: {forbidden_elements}

要件:
1. プロンプトは英語で200〜300語
2. 案件本文に明記された成果物を必ず作る。表紙なら表紙、ロゴならロゴ、商品シールなら商品シール、バナーならバナーとして指定する
3. 案件本文に明記された商品・媒体・テーマ・文言・サイズ・納品条件を必ず反映する
4. 案件にない架空の商品、業種、旅行・美容・料理などの別テーマを混ぜない
5. 具体的な視覚的要素（色、レイアウト、フォントスタイル）を含める
6. {design_taste}のテイストを強調
7. 日本語テキストを入れる場合は、案件本文の文言だけを使う。DALL-Eが文字を崩しやすいので、文字量は少なめにする
8. 商業デザインとして適切なクオリティを指定

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
    job = get_job(job_id) or {}
    delete_prompts_for_job(job_id)

    prompts = []
    for taste in DESIGN_TASTES:
        gemini_input = GEMINI_PROMPT_TEMPLATE.format(
            job_title=_as_text(job.get("title")),
            job_reward=_as_text(job.get("reward")),
            client_name=_as_text(job.get("client_name"), "不明"),
            job_description=_as_text(job.get("description"))[:6000],
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
        f"commercial graphic design image, {size} pixels, {style} design, "
        f"for {purpose}, targeting {target}, "
        f"text elements: '{phrases}', "
        f"high quality commercial banner, professional graphic design, "
        f"sharp typography, balanced composition, marketing material"
    )

from __future__ import annotations
import uuid
import google.generativeai as genai
from backend.config import GEMINI_API_KEY
from backend.db.supabase_client import delete_prompts_for_job, get_job, save_prompt

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")

DESIGN_TASTES = ["モダン", "ポップ", "エレガント"]

GEMINI_PROMPT_TEMPLATE = """あなたはDALL-E 3専門のプロンプトエンジニアです。
以下の案件情報をもとに、DALL-E 3で高品質な制作物を生成するための英語プロンプトを作成してください。

【案件原文（最優先）】
タイトル: {job_title}
クライアント: {client_name}
報酬: {job_reward}
案件本文:
{job_description}

【分析済み仕様】
- 制作物の種類: {deliverable}
- サイズ: {banner_size}
- 目的: {purpose}
- ターゲット: {target_audience}
- 商品・サービス名: {product_or_service}
- ブランドカラー: {brand_colors}
- 含めるテキスト: {key_phrases}
- 視覚要素: {visual_elements}
- スタイルメモ: {style_notes}
- ロゴ必要: {logo_required}
- 禁止要素: {forbidden_elements}
- デザインテイスト: {design_taste}

【プロンプト作成ルール】
1. 英語で250〜350語
2. 制作物の種類を冒頭に明記する（例: "A professional web banner", "A product label design"）
3. 案件本文に記載された商品名・サービス名・会社名をそのまま英語表記で含める
4. ブランドカラーや指定色がある場合は具体的な色名またはHEXで指定する
5. テキスト要素は最小限にする（DALL-E 3はテキスト表示が不安定なため）
   テキストが必要な場合は: 'with minimal text overlay "[テキスト]" in clean sans-serif'
6. {design_taste}のビジュアルテイストを具体的なデザイン用語で表現する
   - モダン: clean lines, whitespace, geometric shapes, sans-serif typography
   - ポップ: vibrant colors, bold typography, energetic composition, playful elements
   - エレガント: refined color palette, luxury feel, sophisticated layout, premium materials
7. 案件にない業種・テーマは混入しない
8. 最後に "high quality, professional commercial design, sharp details, print-ready" を付加する

英語プロンプトのみ返してください（説明・前置き不要）。"""


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
            deliverable=_as_text(analyzed_job.get("deliverable"), "Webバナー"),
            banner_size=_as_text(analyzed_job.get("banner_size"), "1200x628"),
            purpose=_as_text(analyzed_job.get("purpose")),
            target_audience=_as_text(analyzed_job.get("target_audience")),
            product_or_service=_as_text(analyzed_job.get("product_or_service"), "不明"),
            brand_colors=", ".join(analyzed_job.get("brand_colors", [])) or "指定なし",
            key_phrases=", ".join(analyzed_job.get("key_phrases", [])) or "なし",
            visual_elements=", ".join(analyzed_job.get("visual_elements", [])) or "なし",
            style_notes=_as_text(analyzed_job.get("style_notes"), "なし"),
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

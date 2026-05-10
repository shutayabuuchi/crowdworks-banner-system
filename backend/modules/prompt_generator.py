from __future__ import annotations
import json
import re
import time
import uuid
import google.generativeai as genai
from backend.config import GEMINI_API_KEY
from backend.db.supabase_client import delete_prompts_for_job, get_job, save_prompt

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")

NUM_PROPOSALS = 3

GEMINI_PROMPT_TEMPLATE = """あなたはバナーデザインの専門家です。
以下の案件情報を深く読み込み、この案件に最適なデザイン提案を{num_proposals}案作成してください。

【案件情報】
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

【タスク】
この案件のターゲット・業種・目的・商品の特性を深く理解し、
「この案件だからこそ」のデザイン方向性を{num_proposals}案提案してください。

デザイン方向性は「モダン/ポップ/エレガント」のような汎用テイストではなく、
案件内容に根ざした固有のアプローチを考えてください。

【画像プロンプト作成ルール】
1. 英語で250〜350語
2. 制作物の種類を冒頭に明記（例: "A professional web banner advertisement"）
3. 案件の商品名・サービス名・会社名をそのまま英語表記で含める
4. ブランドカラーや指定色がある場合は具体的な色名またはHEXで指定
5. テキスト要素は最小限にする（gpt-image-1はテキスト表示が不安定）
6. 具体的な画像要素・ライティング・構図・雰囲気を描写する
7. 案件と無関係な業種・テーマは絶対に混入しない
8. 最後に "high quality, professional commercial design, sharp details" を付加

【出力形式】
JSONの配列のみを返してください（説明・コードブロック不要）:
[
  {{
    "taste_name": "方向性1の名前（日本語・20文字以内）",
    "taste_rationale": "なぜこの方向性が適切か（日本語・60文字以内）",
    "prompt": "英語プロンプト本文"
  }},
  {{
    "taste_name": "方向性2の名前（日本語・20文字以内）",
    "taste_rationale": "なぜこの方向性が適切か（日本語・60文字以内）",
    "prompt": "英語プロンプト本文"
  }},
  {{
    "taste_name": "方向性3の名前（日本語・20文字以内）",
    "taste_rationale": "なぜこの方向性が適切か（日本語・60文字以内）",
    "prompt": "英語プロンプト本文"
  }}
]"""


def _as_text(value, default: str = "") -> str:
    if isinstance(value, list):
        return "、".join(str(item) for item in value if item)
    if value is None:
        return default
    return str(value)


def _call_gemini(prompt_text: str, max_retries: int = 2) -> str:
    """Call Gemini with exponential backoff on transient errors."""
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            response = model.generate_content(prompt_text)
            return response.text.strip()
        except Exception as e:
            last_exc = e
            print(f"[PromptGen] Gemini attempt {attempt + 1} failed: {type(e).__name__}: {e}")
            if attempt < max_retries:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Gemini failed after {max_retries + 1} attempts: {last_exc}")


def _parse_json_response(text: str) -> list[dict]:
    """Extract a JSON array from Gemini's response, stripping markdown fences."""
    cleaned = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    # Find the outermost [ ... ] block
    match = re.search(r"\[.*\]", cleaned, re.DOTALL)
    candidate = match.group() if match else cleaned
    try:
        result = json.loads(candidate)
        if not isinstance(result, list):
            raise ValueError(f"Expected JSON array, got {type(result).__name__}")
        return result
    except (json.JSONDecodeError, ValueError) as e:
        raise ValueError(f"Could not parse JSON array from Gemini response: {e}\nRaw (first 400): {text[:400]}")


def generate_prompts(analyzed_job: dict) -> list:
    """Ask Gemini to propose job-specific design directions and generate one prompt each."""
    job_id = analyzed_job["job_id"]
    job = get_job(job_id) or {}
    delete_prompts_for_job(job_id)

    gemini_input = GEMINI_PROMPT_TEMPLATE.format(
        num_proposals=NUM_PROPOSALS,
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
        logo_required="はい" if analyzed_job.get("logo_required") else "いいえ",
        forbidden_elements=", ".join(analyzed_job.get("forbidden_elements", [])) or "なし",
    )

    proposals: list[dict] = []
    try:
        raw = _call_gemini(gemini_input)
        proposals = _parse_json_response(raw)
    except Exception as e:
        print(f"[PromptGen] Using fallback proposals: {e}")
        proposals = _fallback_proposals(analyzed_job)

    prompts = []
    for proposal in proposals[:NUM_PROPOSALS]:
        taste_name = _as_text(proposal.get("taste_name"), "提案")
        taste_rationale = _as_text(proposal.get("taste_rationale"), "")
        # Encode rationale into design_taste (no schema change): "名前|理由"
        encoded_taste = f"{taste_name}|{taste_rationale}" if taste_rationale else taste_name

        prompt = {
            "job_id": job_id,
            "prompt_id": f"PR{str(uuid.uuid4())[:8].upper()}",
            "text_prompt": _as_text(proposal.get("prompt"), ""),
            "design_taste": encoded_taste,
            "gemini_input": gemini_input,
        }
        save_prompt(prompt)
        prompts.append(prompt)

    return prompts


def _fallback_proposals(analyzed_job: dict) -> list[dict]:
    purpose = _as_text(analyzed_job.get("purpose"), "product promotion")
    target = _as_text(analyzed_job.get("target_audience"), "general audience")
    product = _as_text(analyzed_job.get("product_or_service"), "product")
    phrases = ", ".join(analyzed_job.get("key_phrases", []))

    base = (
        f"A professional web banner for {product}, targeting {target}, "
        f"purpose: {purpose}, key messages: '{phrases}', "
        f"high quality, professional commercial design, sharp details"
    )

    return [
        {
            "taste_name": "クリーン・シンプル",
            "taste_rationale": "視認性を最優先にした汎用アプローチ",
            "prompt": f"{base}, clean minimal design, white background, clear typography, balanced layout",
        },
        {
            "taste_name": "ビビッド・インパクト",
            "taste_rationale": "注目を集めるための高コントラスト構成",
            "prompt": f"{base}, bold vibrant colors, strong visual impact, dynamic composition",
        },
        {
            "taste_name": "プレミアム・質感",
            "taste_rationale": "高品質・信頼感を訴求する落ち着いた表現",
            "prompt": f"{base}, premium feel, sophisticated color palette, refined layout, luxury aesthetic",
        },
    ]

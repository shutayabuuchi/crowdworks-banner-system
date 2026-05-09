import uuid
from datetime import datetime, timezone
import anthropic
from backend.config import ANTHROPIC_API_KEY
from backend.db.supabase_client import save_application_text

claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

APP_TEXT_PROMPT = """あなたはフリーランスのバナーデザイナーです。以下の案件情報と制作したバナーの情報をもとに、クラウドワークスへの応募文を作成してください。

【案件情報】
タイトル: {title}
ターゲット層: {target_audience}
目的: {purpose}
報酬: {reward}

【制作バナー情報】
デザインテイスト: {design_taste}
バナーサイズ: {banner_size}
使用したコンセプト: {key_phrases}

応募文の要件:
1. 丁寧で誠実なビジネス文体
2. 400〜600文字
3. 以下の構成:
   - 挨拶と案件への関心
   - バナーのコンセプト説明（デザインテイストと意図）
   - 自分のスキルアピール
   - 修正対応への柔軟性
   - 締めの言葉
4. クライアントのブランドや要望を理解していることをアピール

応募文のみを返してください。"""


def generate_application_text(request: dict) -> dict:
    """Generate application text based on job and banner details."""
    job_details = request.get("job_details", {})
    banner_details = request.get("banner_details", {})

    prompt = APP_TEXT_PROMPT.format(
        title=job_details.get("title", ""),
        target_audience=job_details.get("target_audience", ""),
        purpose=job_details.get("purpose", ""),
        reward=job_details.get("reward", ""),
        design_taste=banner_details.get("design_taste", ""),
        banner_size=job_details.get("banner_size", ""),
        key_phrases=", ".join(job_details.get("key_phrases", [])),
    )

    response = claude.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text_content = response.content[0].text.strip()
    app_text = {
        "job_id": request["job_id"],
        "application_id": f"APP{str(uuid.uuid4())[:8].upper()}",
        "banner_id": request["selected_banner_id"],
        "text_content": text_content,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    save_application_text(app_text)
    return app_text

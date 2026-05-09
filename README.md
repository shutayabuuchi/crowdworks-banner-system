# Crowdworks Banner System

Crowdworksの案件取得、案件分析、バナー生成、応募文生成を行うFastAPIアプリです。フロントエンドは `frontend/` の静的ファイルをFastAPIから配信します。

## ローカル起動

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

ブラウザで `http://localhost:8000` を開きます。

## Supabase設定

テストサイトと本番を分ける場合は、Supabaseプロジェクトを2つ作るのがおすすめです。

- `crowdworks-banner-system-staging`
- `crowdworks-banner-system-production`

それぞれのSupabase SQL Editorで `supabase_schema.sql` を実行します。Storageは `banners` バケットをPublic、`assets` バケットをPrivateで作成してください。

## 環境変数

`.env` はGitHubに上げません。GitHubやRenderなどのデプロイ先では、環境ごとに以下を設定します。

```bash
APP_ENV=staging
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
CORS_ORIGINS=https://your-staging-site.onrender.com
```

本番では `APP_ENV=production` にして、本番用Supabaseプロジェクトの値を入れます。`SUPABASE_SERVICE_KEY` は強い権限を持つため、フロントエンドには絶対に埋め込まないでください。

## GitHubに上げる流れ

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:<your-account>/crowdworks-banner-system.git
git push -u origin main
```

## テストサイトと本番の分け方

おすすめ構成は、GitHubブランチとデプロイ先を分ける形です。

- `main`: 本番サイト
- `develop`: テストサイト
- Supabase本番プロジェクト: `main` のデプロイ先だけに設定
- Supabaseテストプロジェクト: `develop` のデプロイ先だけに設定

Renderを使う場合は、同じGitHubリポジトリからWeb Serviceを2つ作ります。片方は `develop` ブランチを指定してstaging用環境変数を入れ、もう片方は `main` ブランチを指定してproduction用環境変数を入れます。

Vercelを使う場合も、同じGitHubリポジトリからVercel Projectを2つ作るのがおすすめです。片方はProduction Branchを `develop` にしてstaging用環境変数を入れ、もう片方はProduction Branchを `main` にしてproduction用環境変数を入れます。

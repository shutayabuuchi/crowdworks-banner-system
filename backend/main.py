from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from backend.api.jobs import router as jobs_router
from backend.api.prompts import router as prompts_router
from backend.api.banners import router as banners_router
from backend.api.application_texts import router as app_texts_router
from backend.config import CORS_ORIGINS

app = FastAPI(
    title="クラウドワークス バナー自動生成システム",
    description="Crowdworks banner auto-generation system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_router)
app.include_router(prompts_router)
app.include_router(banners_router)
app.include_router(app_texts_router)

# Serve frontend
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

    @app.api_route("/", methods=["GET", "HEAD"])
    async def serve_frontend():
        return FileResponse(os.path.join(frontend_path, "index.html"))

    @app.api_route("/style.css", methods=["GET", "HEAD"])
    async def serve_legacy_stylesheet():
        return FileResponse(os.path.join(frontend_path, "style.css"), media_type="text/css")

    @app.api_route("/app.js", methods=["GET", "HEAD"])
    async def serve_legacy_script():
        return FileResponse(os.path.join(frontend_path, "app.js"), media_type="text/javascript")


@app.get("/health")
async def health():
    return {"status": "ok"}

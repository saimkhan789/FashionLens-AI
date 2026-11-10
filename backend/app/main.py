from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.ai import models as ai
from app.api import account, admin, auth, catalog, go, search
from app.config import settings
from app.db import init_db
from app.ingest import pipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    if settings.LOAD_MODELS:
        ai.start_loading()
    await pipeline.start_worker()
    yield


app = FastAPI(title="FashionLens AI", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
for module in (auth, search, catalog, account, admin, go):
    api.include_router(module.router)


@api.get("/health")
async def health():
    return {"status": "ok", "models": ai.status()}


@api.get("/config")
async def public_config():
    """Settings the frontend needs at runtime (the static build can't read .env)."""
    return {
        "google_client_id": settings.GOOGLE_CLIENT_ID or None,
        "guest_text_searches": settings.GUEST_TEXT_SEARCHES,
        "guest_image_searches": settings.GUEST_IMAGE_SEARCHES,
    }


app.include_router(api)


# The Next.js frontend is exported as static files (frontend/out) and served from
# here, so one process runs the whole app.
@app.get("/{path:path}", include_in_schema=False)
async def frontend(path: str):
    root = settings.FRONTEND_DIR.resolve()
    if path.startswith("api/"):
        raise HTTPException(status_code=404)
    if not root.is_dir():
        return {"detail": "Frontend not built. Run `python run.py` (it builds it) or `python run.py --dev`."}
    for candidate in (path, f"{path}.html", f"{path}/index.html"):
        file = (root / candidate).resolve()
        if file.is_file() and file.is_relative_to(root):
            return FileResponse(file)
    return FileResponse(root / "404.html", status_code=404)

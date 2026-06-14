from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database.connection import connect_db, disconnect_db
from app.api.auth import router as auth_router
from app.api.search import router as search_router
from app.api.history import router as history_router
from app.api.favorites import router as favorites_router
from app.api.metrics import router as metrics_router
from app.ai.similarity import load_resources
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    load_resources()
    yield
    await disconnect_db()


app = FastAPI(title="FashionLens AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "datasets", "raw", "images"))
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

app.include_router(auth_router)
app.include_router(search_router)
app.include_router(history_router)
app.include_router(favorites_router)
app.include_router(metrics_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "FashionLens AI"}




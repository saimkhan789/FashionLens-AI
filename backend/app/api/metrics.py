from fastapi import APIRouter, HTTPException
import json
import os

router = APIRouter(prefix="/metrics", tags=["metrics"])

METRICS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "models", "evaluation", "metrics.json"))


@router.get("")
async def get_metrics():
    if not os.path.exists(METRICS_PATH):
        raise HTTPException(status_code=404, detail="Metrics not generated yet")
    with open(METRICS_PATH, "r") as f:
        return json.load(f)
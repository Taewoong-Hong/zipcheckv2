"""최소한의 FastAPI 앱 - 디버깅용"""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ZipCheck AI - Minimal")

class HealthResponse(BaseModel):
    ok: bool
    version: str = "2.0.0-minimal"
    environment: str

@app.get("/healthz", response_model=HealthResponse)
async def health_check():
    """헬스체크 엔드포인트"""
    return HealthResponse(
        ok=True,
        environment="production",
    )

@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {"message": "ZipCheck AI Service - Minimal Version"}

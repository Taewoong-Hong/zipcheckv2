"""최소 테스트용 FastAPI 앱 (OpenAI 연동)."""
import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ZipCheck AI - Minimal")


# OpenAI 클라이언트를 lazy하게 초기화 (앱 시작 시점이 아닌 요청 시점)
def get_openai_client():
    """OpenAI 클라이언트를 lazy하게 생성"""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.error("OPENAI_API_KEY environment variable is not set")
        raise ValueError("OPENAI_API_KEY environment variable is required")

    logger.info(f"Creating OpenAI client with API key (first 10 chars): {api_key[:10]}...")
    return OpenAI(api_key=api_key)


# Request 모델
class AnalyzeRequest(BaseModel):
    question: str
    model: str = "gpt-4o-mini"

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "ZipCheck AI Service", "version": "2.0.0-minimal"}

@app.get("/health")
def health_check():
    return {
        "ok": True,
        "version": "2.0.0-minimal",
        "environment": os.environ.get("APP_ENV", "production")
    }

@app.get("/healthz")
def health_check_z():
    """Legacy healthz endpoint for Cloud Run"""
    return {
        "ok": True,
        "version": "2.0.0-minimal",
        "environment": os.environ.get("APP_ENV", "production")
    }


@app.post("/analyze")
async def analyze(body: AnalyzeRequest):
    """계약서 리스크 분석 엔드포인트 (OpenAI 연동)"""
    try:
        logger.info(f"Received analyze request: question='{body.question[:50]}...', model={body.model}")

        client = get_openai_client()
        logger.info("OpenAI client created successfully")

        logger.info(f"Calling OpenAI API with model {body.model}")
        response = client.chat.completions.create(
            model=body.model,
            messages=[
                {
                    "role": "system",
                    "content": "너는 부동산 계약 리스크 점검 전문가야. 사용자의 질문에 대해 명확하고 구체적으로 답변해줘."
                },
                {
                    "role": "user",
                    "content": body.question
                }
            ],
            temperature=0.2,
        )
        logger.info("OpenAI API call successful")

        return {
            "ok": True,
            "answer": response.choices[0].message.content,
            "model": body.model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        }
    except Exception as e:
        logger.error(f"Error in /analyze endpoint: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"OpenAI API 오류: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
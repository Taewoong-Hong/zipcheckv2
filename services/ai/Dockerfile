# Python 3.11 슬림 베이스 이미지
FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치 (gcc는 일부 Python 패키지 빌드에 필요)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치 (OpenAI 최신 버전 사용)
RUN pip install --no-cache-dir \
    fastapi==0.109.0 \
    uvicorn[standard]==0.27.0 \
    "openai>=1.60.0"

# 애플리케이션 파일 복사
COPY app_minimal.py .

# Cloud Run이 동적으로 할당하는 PORT 환경 변수 사용
ENV PORT=8080
EXPOSE 8080

# uvicorn으로 FastAPI 실행
CMD ["sh", "-c", "uvicorn app_minimal:app --host 0.0.0.0 --port ${PORT}"]

# Python 3.11 슬림 베이스 이미지
FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app/services/ai

# 시스템 의존성 설치 (gcc, libmagic, git)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libmagic1 \
    git \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 파일 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# GitHub PAT을 ARG로 받아서 Private 크롤러 패키지 설치
ARG GITHUB_TOKEN
RUN if [ -n "$GITHUB_TOKEN" ]; then \
        git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/" && \
        pip install --no-cache-dir git+https://github.com/Taewoong-Hong/zipcheck_rawl.git@main && \
        git config --global --unset-all url."https://github.com/".insteadOf || true; \
    else \
        echo "GITHUB_TOKEN not provided, skipping zipcheck-crawler installation"; \
    fi

# 애플리케이션 코드 전체 복사
COPY . .

# Cloud Run이 동적으로 할당하는 PORT 환경 변수 사용
ENV PORT=8080
EXPOSE 8080

# Uvicorn 단독 실행 (Gunicorn 워커 타임아웃 이슈 제거)
# Cloud Run 단일 인스턴스 환경에서는 Uvicorn 단독으로 충분
# --timeout-keep-alive 600: 장시간 PDF 파싱(GPT-4o Vision OCR)을 위한 10분 타임아웃
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 600 --log-level info"]

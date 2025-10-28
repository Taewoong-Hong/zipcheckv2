# Python 3.11 슬림 베이스 이미지
FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치 (gcc, libmagic, git 등)
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

# Gunicorn + Uvicorn worker로 프로덕션 실행
# --workers=1: 메모리 1Gi에 적합 (필요시 증가)
# --timeout=120: 긴 요청 대비 타임아웃
# --graceful-timeout=30: 우아한 종료
CMD ["sh", "-c", "gunicorn app:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT} --workers 1 --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile -"]

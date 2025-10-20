#!/bin/bash

echo "===================================="
echo "ZipCheck AI 서비스 설치 스크립트"
echo "===================================="
echo ""

echo "[1/4] Python 버전 확인..."
python3 --version
if [ $? -ne 0 ]; then
    echo "오류: Python이 설치되지 않았습니다."
    echo "https://www.python.org/downloads/ 에서 Python 3.11 이상을 설치해주세요."
    exit 1
fi
echo ""

echo "[2/4] 가상환경 생성..."
if [ -d "venv" ]; then
    echo "가상환경이 이미 존재합니다. 건너뜁니다."
else
    python3 -m venv venv
    echo "가상환경 생성 완료!"
fi
echo ""

echo "[3/4] 가상환경 활성화..."
source venv/bin/activate
echo ""

echo "[4/4] 패키지 설치..."
echo "이 작업은 몇 분 소요될 수 있습니다..."
pip install --upgrade pip
pip install -r requirements.txt
echo ""

echo "===================================="
echo "설치 완료!"
echo "===================================="
echo ""
echo "다음 단계:"
echo "1. .env 파일을 열어 API 키를 입력하세요"
echo "   - DATABASE_URL"
echo "   - OPENAI_API_KEY"
echo "   - ANTHROPIC_API_KEY"
echo ""
echo "2. 서버를 시작하세요:"
echo "   uvicorn app:app --reload"
echo ""
echo "3. 브라우저에서 확인하세요:"
echo "   http://localhost:8000/docs"
echo ""

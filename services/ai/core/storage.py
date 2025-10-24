"""
Supabase Storage 서명 URL 유틸리티

⚠️ 보안 원칙:
1. 모든 파일 업로드/다운로드는 서명 URL 사용 (짧은 만료 시간)
2. 공개 URL 사용 금지 (비공개 버킷만 사용)
3. 파일 경로는 사용자별 폴더 격리: {user_id}/{doc_id}/{filename}
4. Service Role Key는 백엔드에서만 사용
"""

import os
import logging
from typing import Optional, Dict, Any
from datetime import timedelta
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://gsiismzchtgdklvdvggu.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Supabase 클라이언트 (Service Role)
# ⚠️ 주의: Service Role은 모든 RLS를 우회하므로 백엔드에서만 사용!
supabase: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Supabase Service Role 클라이언트 가져오기

    Returns:
        Supabase 클라이언트
    """
    global supabase

    if supabase is not None:
        return supabase

    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY environment variable is required"
        )

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    logger.info("Supabase client initialized with Service Role")
    return supabase


def create_signed_upload_url(
    user_id: str,
    doc_id: str,
    filename: str,
    expires_in: int = 3600  # 1시간
) -> Dict[str, str]:
    """
    파일 업로드용 서명 URL 생성

    Args:
        user_id: 사용자 ID (UUID)
        doc_id: 문서 ID (UUID)
        filename: 파일명
        expires_in: 만료 시간 (초, 기본값: 1시간)

    Returns:
        {
            "upload_url": "https://...",
            "file_path": "documents/{user_id}/{doc_id}/{filename}",
            "expires_at": "2025-01-24T12:00:00Z"
        }
    """
    client = get_supabase_client()

    # 파일 경로 구성: documents/{user_id}/{doc_id}/{filename}
    file_path = f"{user_id}/{doc_id}/{filename}"

    try:
        # 서명 URL 생성 (업로드용)
        response = client.storage.from_("documents").create_signed_upload_url(
            file_path
        )

        logger.info(f"Created upload URL for: {file_path}")

        return {
            "upload_url": response["signedURL"],
            "file_path": file_path,
            "token": response.get("token"),  # 업로드 시 필요한 토큰
            "expires_in": expires_in
        }

    except Exception as e:
        logger.error(f"Failed to create upload URL: {e}")
        raise ValueError(f"Failed to create upload URL: {str(e)}")


def create_signed_download_url(
    file_path: str,
    expires_in: int = 3600  # 1시간
) -> str:
    """
    파일 다운로드용 서명 URL 생성

    Args:
        file_path: Storage 파일 경로 (예: "user_id/doc_id/file.pdf")
        expires_in: 만료 시간 (초, 기본값: 1시간)

    Returns:
        서명된 다운로드 URL
    """
    client = get_supabase_client()

    try:
        # 서명 URL 생성 (다운로드용)
        response = client.storage.from_("documents").create_signed_url(
            file_path,
            expires_in
        )

        logger.info(f"Created download URL for: {file_path} (expires in {expires_in}s)")

        return response["signedURL"]

    except Exception as e:
        logger.error(f"Failed to create download URL: {e}")
        raise ValueError(f"Failed to create download URL: {str(e)}")


def upload_file(
    user_id: str,
    doc_id: str,
    filename: str,
    file_content: bytes,
    content_type: str = "application/pdf"
) -> str:
    """
    파일 직접 업로드 (백엔드에서 사용)

    Args:
        user_id: 사용자 ID
        doc_id: 문서 ID
        filename: 파일명
        file_content: 파일 내용 (바이너리)
        content_type: MIME 타입

    Returns:
        업로드된 파일 경로
    """
    client = get_supabase_client()

    # 파일 경로 구성
    file_path = f"{user_id}/{doc_id}/{filename}"

    try:
        # 파일 업로드
        client.storage.from_("documents").upload(
            file_path,
            file_content,
            {
                "content-type": content_type,
                "x-upsert": "true"  # 덮어쓰기 허용
            }
        )

        logger.info(f"Uploaded file: {file_path}")
        return file_path

    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        raise ValueError(f"Failed to upload file: {str(e)}")


def download_file(file_path: str) -> bytes:
    """
    파일 직접 다운로드 (백엔드에서 사용)

    Args:
        file_path: Storage 파일 경로

    Returns:
        파일 내용 (바이너리)
    """
    client = get_supabase_client()

    try:
        # 파일 다운로드
        response = client.storage.from_("documents").download(file_path)

        logger.info(f"Downloaded file: {file_path}")
        return response

    except Exception as e:
        logger.error(f"Failed to download file: {e}")
        raise ValueError(f"Failed to download file: {str(e)}")


def delete_file(file_path: str) -> bool:
    """
    파일 삭제 (백엔드에서 사용)

    Args:
        file_path: Storage 파일 경로

    Returns:
        삭제 성공 여부
    """
    client = get_supabase_client()

    try:
        # 파일 삭제
        client.storage.from_("documents").remove([file_path])

        logger.info(f"Deleted file: {file_path}")
        return True

    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
        return False


def list_user_files(user_id: str, doc_id: Optional[str] = None) -> list:
    """
    사용자 파일 목록 조회

    Args:
        user_id: 사용자 ID
        doc_id: 문서 ID (선택적)

    Returns:
        파일 목록
    """
    client = get_supabase_client()

    # 경로 구성
    path = f"{user_id}/{doc_id}" if doc_id else user_id

    try:
        # 파일 목록 조회
        files = client.storage.from_("documents").list(path)

        logger.info(f"Listed files for: {path}")
        return files

    except Exception as e:
        logger.error(f"Failed to list files: {e}")
        return []


# ============================================
# 사용 예시
# ============================================
"""
from fastapi import FastAPI, UploadFile, Depends
from core.auth import get_current_user
from core.storage import (
    create_signed_upload_url,
    create_signed_download_url,
    upload_file,
    download_file
)

app = FastAPI()

# 1. 프론트엔드에서 서명 URL 요청 (추천 방식)
@app.post("/documents/upload-url")
async def get_upload_url(
    doc_id: str,
    filename: str,
    user: dict = Depends(get_current_user)
):
    user_id = user["sub"]

    # 서명 URL 생성
    result = create_signed_upload_url(user_id, doc_id, filename)

    # 프론트엔드에서 이 URL로 직접 업로드
    return result

# 2. 백엔드에서 직접 업로드 (PDF 처리 등)
@app.post("/documents/process")
async def process_document(
    file: UploadFile,
    user: dict = Depends(get_current_user)
):
    user_id = user["sub"]
    doc_id = "generated_doc_id"

    # 파일 읽기
    content = await file.read()

    # Storage에 업로드
    file_path = upload_file(user_id, doc_id, file.filename, content)

    # 다운로드 URL 생성 (AI 처리용)
    download_url = create_signed_download_url(file_path, expires_in=3600)

    # AI 처리 로직...

    return {"file_path": file_path}

# 3. 파일 다운로드
@app.get("/documents/{doc_id}/download")
async def download_document(
    doc_id: str,
    user: dict = Depends(get_current_user)
):
    user_id = user["sub"]
    file_path = f"{user_id}/{doc_id}/document.pdf"

    # 서명 URL 생성 (짧은 만료 시간)
    signed_url = create_signed_download_url(file_path, expires_in=300)  # 5분

    return {"download_url": signed_url}
"""

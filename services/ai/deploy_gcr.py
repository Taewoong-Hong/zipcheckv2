#!/usr/bin/env python3
"""
Google Cloud Run 자동 배포 스크립트

ZipCheck AI FastAPI 백엔드를 Cloud Run에 배포합니다.
dev router 포함한 최신 코드를 배포하여 HTTP 500 에러를 해결합니다.
"""
import os
import subprocess
import sys
import json
import time
from pathlib import Path

def run_command(command, description):
    """명령어 실행 및 결과 반환"""
    print(f"\n🔄 {description}")
    print(f"Command: {command}")
    
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        cwd="C:/dev/zipcheckv2/services/ai"
    )
    
    if result.returncode == 0:
        print(f"✅ 성공: {description}")
        if result.stdout:
            print(f"Output: {result.stdout.strip()}")
        return True, result.stdout
    else:
        print(f"❌ 실패: {description}")
        print(f"Error: {result.stderr}")
        return False, result.stderr

def check_prerequisites():
    """배포 전 필수 조건 확인"""
    print("📋 배포 전 필수 조건 확인 중...")
    
    # gcloud CLI 설치 확인
    success, _ = run_command("gcloud version", "gcloud CLI 설치 확인")
    if not success:
        print("❌ gcloud CLI가 설치되지 않았습니다.")
        print("📥 설치 링크: https://cloud.google.com/sdk/docs/install")
        return False
    
    # 프로젝트 설정 확인
    success, output = run_command("gcloud config get-value project", "현재 GCP 프로젝트 확인")
    if not success or not output.strip():
        print("❌ GCP 프로젝트가 설정되지 않았습니다.")
        print("💡 설정 방법: gcloud config set project PROJECT_ID")
        return False
    
    project_id = output.strip()
    print(f"✅ 프로젝트: {project_id}")
    
    # 인증 확인
    success, _ = run_command("gcloud auth list --filter=status:ACTIVE", "인증 상태 확인")
    if not success:
        print("❌ gcloud 인증이 필요합니다.")
        print("💡 인증 방법: gcloud auth login")
        return False
    
    # 필요한 API 활성화 확인
    apis = ["cloudbuild.googleapis.com", "run.googleapis.com", "secretmanager.googleapis.com"]
    for api in apis:
        success, _ = run_command(f"gcloud services list --enabled --filter=name:{api}", f"API 활성화 확인: {api}")
        if not success:
            print(f"⚠️ API 활성화 필요: {api}")
            run_command(f"gcloud services enable {api}", f"API 활성화: {api}")
    
    return True

def check_secrets():
    """Secret Manager 시크릿 존재 확인"""
    print("\n🔐 Secret Manager 시크릿 확인 중...")
    
    required_secrets = [
        "openai-api-key",
        "supabase-database-url", 
        "supabase-jwt-secret",
        "supabase-anon-key",
        "supabase-service-role-key",
        "vworld-api-key-production"
    ]
    
    missing_secrets = []
    
    for secret in required_secrets:
        success, _ = run_command(
            f"gcloud secrets describe {secret}",
            f"시크릿 확인: {secret}"
        )
        if not success:
            missing_secrets.append(secret)
    
    if missing_secrets:
        print(f"❌ 누락된 시크릿: {', '.join(missing_secrets)}")
        print("💡 Secret Manager에서 시크릿을 생성해주세요.")
        return False
    
    print("✅ 모든 필수 시크릿이 존재합니다.")
    return True

def deploy_to_cloud_run():
    """Cloud Run 배포 실행"""
    print("\n🚀 Cloud Run 배포 시작...")
    
    # 배포 명령어 구성
    deploy_command = """gcloud run deploy zipcheck-ai \\
--source . \\
--region asia-northeast3 \\
--allow-unauthenticated \\
--set-env-vars "APP_ENV=production,LOG_LEVEL=INFO" \\
--set-secrets "OPENAI_API_KEY=openai-api-key:latest,DATABASE_URL=supabase-database-url:latest,JWT_SECRET=supabase-jwt-secret:latest,SUPABASE_ANON_KEY=supabase-anon-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,VWORLD_API_KEY=vworld-api-key-production:latest" \\
--memory 1Gi \\
--cpu 1 \\
--timeout 300 \\
--max-instances 10 \\
--min-instances 0"""
    
    success, output = run_command(deploy_command.replace('\\\n', ' '), "Cloud Run 배포")
    
    if success:
        # 배포된 URL 추출
        lines = output.split('\n')
        service_url = None
        for line in lines:
            if 'https://' in line and 'run.app' in line:
                service_url = line.strip()
                break
        
        if service_url:
            print(f"\n🎉 배포 완료!")
            print(f"🌐 서비스 URL: {service_url}")
            print(f"🔧 Dev 엔드포인트: {service_url}/dev/parse-registry")
            return True, service_url
    
    return False, None

def verify_deployment(service_url):
    """배포 검증"""
    if not service_url:
        return False
    
    print(f"\n🔍 배포 검증 중...")
    
    # Health check
    import requests
    import time
    
    try:
        # 서비스가 시작될 때까지 대기
        print("⏳ 서비스 시작 대기 중...")
        time.sleep(10)
        
        health_url = f"{service_url}/health"
        response = requests.get(health_url, timeout=30)
        
        if response.status_code == 200:
            print(f"✅ Health check 성공: {health_url}")
            
            # Dev endpoint 확인
            dev_url = f"{service_url}/dev"
            try:
                dev_response = requests.get(dev_url, timeout=10)
                print(f"✅ Dev router 접근 가능: {dev_url} (status: {dev_response.status_code})")
                return True
            except Exception as e:
                print(f"⚠️ Dev router 확인 실패: {e}")
                return False
        else:
            print(f"❌ Health check 실패: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ 배포 검증 실패: {e}")
        return False

def main():
    """메인 배포 프로세스"""
    print("=" * 70)
    print("🚀 ZipCheck AI Cloud Run 자동 배포")
    print("=" * 70)
    
    try:
        # 1. 필수 조건 확인
        if not check_prerequisites():
            print("\n❌ 배포 전 필수 조건이 충족되지 않았습니다.")
            return False
        
        # 2. 시크릿 확인
        if not check_secrets():
            print("\n❌ 필수 시크릿이 누락되었습니다.")
            return False
        
        # 3. 현재 디렉토리 확인
        current_dir = Path.cwd()
        expected_dir = Path("C:/dev/zipcheckv2/services/ai")
        
        if current_dir != expected_dir:
            print(f"📂 작업 디렉토리 이동: {expected_dir}")
            os.chdir(expected_dir)
        
        # 4. 주요 파일 존재 확인
        required_files = ["app.py", "routes/dev.py", "requirements.txt"]
        for file_path in required_files:
            if not Path(file_path).exists():
                print(f"❌ 필수 파일 누락: {file_path}")
                return False
        print("✅ 모든 필수 파일 존재 확인")
        
        # 5. Cloud Run 배포
        success, service_url = deploy_to_cloud_run()
        if not success:
            print("\n❌ Cloud Run 배포 실패")
            return False
        
        # 6. 배포 검증
        if verify_deployment(service_url):
            print("\n🎉 배포 및 검증 완료!")
            print(f"   Frontend의 AI_API_URL을 다음으로 업데이트하세요:")
            print(f"   {service_url}")
            return True
        else:
            print("\n⚠️ 배포는 성공했지만 검증에서 일부 이슈가 발견되었습니다.")
            print(f"   수동으로 확인해보세요: {service_url}/health")
            return True
            
    except KeyboardInterrupt:
        print("\n\n⏹️ 사용자에 의해 배포가 중단되었습니다.")
        return False
    except Exception as e:
        print(f"\n❌ 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
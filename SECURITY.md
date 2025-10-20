# 보안 가이드 - ZipCheck v2

## 🔐 민감 정보 보호

### ⚠️ **절대 Git에 커밋하면 안 되는 파일**

```bash
# ❌ NEVER COMMIT THESE FILES
.env                    # 실제 API 키가 포함된 환경 변수
.env.local             # 로컬 환경 변수
.env.*.local           # 환경별 로컬 변수
*.pem, *.key           # 인증서/개인키
credentials.json       # 서비스 계정 인증 정보
secrets/               # 시크릿 디렉토리
```

### ✅ **Git에 커밋해도 되는 파일**

```bash
# ✅ SAFE TO COMMIT
.env.example           # 템플릿 (실제 값 없음)
.gitignore             # Git 제외 규칙
SECURITY.md            # 이 문서
```

---

## 📋 보안 체크리스트

### 1. **환경 변수 설정**

#### 최초 설정 (한 번만)
```bash
# 1. .env.example을 .env로 복사
cd services/ai
cp .env.example .env

# 2. .env 파일 편집 - 실제 API 키 입력
# OPENAI_API_KEY=sk-proj-your-actual-key-here
# DATABASE_URL=postgresql://postgres.<project-ref>:...
```

#### ⚠️ **절대 하지 말 것**
```bash
# ❌ .env 파일을 Git에 추가
git add .env  # 절대 실행하지 마세요!

# ❌ .env 파일을 공개 저장소에 푸시
git push  # .env가 staging area에 있으면 위험!
```

### 2. **Git 설정**

#### `.gitignore` 확인
```bash
# .gitignore 파일이 루트 디렉토리에 있는지 확인
cat .gitignore | grep ".env"

# 출력 예시:
# .env
# .env.local
# .env.*.local
```

#### Git 상태 확인
```bash
# .env 파일이 untracked 상태인지 확인
git status

# ✅ 올바른 상태:
# Untracked files:
#   (use "git add <file>..." to include in what will be committed)
#         .env  ← 절대 git add 하지 마세요!

# ❌ 위험한 상태:
# Changes to be committed:
#         new file:   .env  ← 즉시 git reset HEAD .env 실행!
```

### 3. **API 키 노출 시 대응**

#### GitHub/GitLab에 실수로 푸시한 경우

**즉시 조치**:
1. **API 키 즉시 무효화**
   ```bash
   # OpenAI Dashboard → API Keys → Revoke
   # https://platform.openai.com/api-keys
   ```

2. **새 API 키 생성 및 교체**
   ```bash
   # .env 파일에 새 키 입력
   OPENAI_API_KEY=sk-proj-NEW-KEY-HERE
   ```

3. **Git 히스토리에서 완전 제거** (고급)
   ```bash
   # BFG Repo-Cleaner 또는 git filter-branch 사용
   # 참고: https://github.com/rtyley/bfg-repo-cleaner

   # 간단한 방법: 전체 리포지토리 삭제 후 재생성
   # (커밋 히스토리가 많지 않은 경우)
   ```

4. **과금 확인**
   ```bash
   # OpenAI Dashboard → Usage
   # 비정상적인 사용량이 있는지 확인
   ```

---

## 🔒 API 키 보안 모범 사례

### 1. **API 키 권한 제한**

```bash
# OpenAI API Key Settings
- Read-only for embedding models
- Write permissions only for necessary models
- Set usage limits (e.g., $10/month)
- Enable rate limiting
```

### 2. **환경별 분리**

```bash
# 개발 환경
.env.development  # 개발용 API 키 (제한된 예산)

# 스테이징 환경
.env.staging      # 테스트용 API 키

# 프로덕션 환경
.env.production   # 실제 운영 API 키 (엄격한 제한)
```

### 3. **비용 모니터링**

```python
# services/ai/core/cost_monitor.py 활용
from core.cost_monitor import get_cost_monitor

monitor = get_cost_monitor()
print(monitor.generate_report())

# 일일/월간 임계값 설정
monitor.daily_threshold = 5.0    # $5/day
monitor.monthly_threshold = 50.0  # $50/month
```

---

## 🚀 프로덕션 배포 시 보안

### 1. **환경 변수 관리 (클라우드)**

#### Vercel
```bash
# Settings → Environment Variables
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgresql://...
```

#### AWS/GCP/Azure
```bash
# Secret Manager / Key Vault 사용
# 절대 .env 파일을 서버에 직접 업로드하지 마세요!
```

#### Docker
```bash
# docker-compose.yml
services:
  ai:
    env_file:
      - .env  # 로컬 개발용
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}  # 프로덕션에서는 환경변수로
```

### 2. **접근 제어**

```yaml
# Supabase RLS (Row Level Security)
- v2_documents: 사용자별 접근 제어
- v2_embeddings: 읽기 전용 권한
- v2_contracts: 소유자만 수정 가능

# API Rate Limiting
- FastAPI middleware로 IP별 제한
- OpenAI API: tier-based limits
```

---

## 📊 보안 감사

### 정기 체크 (월 1회)

```bash
# 1. Git 히스토리 스캔
git log --all --pretty=format: --name-only | grep -E "\.env$|\.pem$|\.key$"

# 2. API 키 로테이션
# OpenAI Dashboard에서 새 키 생성 → 기존 키 무효화

# 3. 비용 확인
# OpenAI Usage Dashboard 확인

# 4. 접근 로그 확인
# Supabase Logs에서 비정상 접근 확인
```

---

## 🆘 긴급 연락처

### API 키 노출 시
1. **OpenAI**: support@openai.com
2. **Anthropic**: support@anthropic.com
3. **Supabase**: support@supabase.io

### 보안 이슈 보고
- Email: security@zipcheck.app (가상 주소)
- GitHub: Security Advisory 탭

---

## 📚 참고 자료

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
- [12-Factor App: Config](https://12factor.net/config)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

---

**마지막 업데이트**: 2025-10-20
**담당자**: 백엔드 개발팀

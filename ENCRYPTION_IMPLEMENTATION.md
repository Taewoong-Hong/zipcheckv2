# 🔐 암호화 시스템 구현 가이드

**작성일**: 2025-01-27
**버전**: 1.0.0

---

## 📋 개요

집체크 v2는 **AES-256-GCM** 알고리즘을 사용하여 고객의 개인정보를 암호화합니다.

### 암호화 대상 데이터
- **v2_profiles**: `name` (이름), `email` (이메일)
- **v2_documents**: `property_address` (부동산 주소), `owner_info.name` (소유자 이름)
- **v2_contracts**: `addr` (주소)

---

## 🔧 구현 구조

### 1️⃣ 프론트엔드 (TypeScript)

**파일**: [apps/web/lib/encryption.ts](apps/web/lib/encryption.ts)

```typescript
import { encrypt, decrypt, encryptFields, decryptFields } from '@/lib/encryption';

// 단일 필드 암호화
const encrypted = encrypt('홍길동');

// 단일 필드 복호화
const decrypted = decrypt(encrypted);

// 객체 필드 암호화
const user = { name: '홍길동', age: 30 };
const encryptedUser = encryptFields(user, ['name']);

// 객체 필드 복호화
const decryptedUser = decryptFields(encryptedUser, ['name']);
```

### 2️⃣ 백엔드 (Python)

**파일**: [services/ai/core/encryption.py](services/ai/core/encryption.py)

```python
from core.encryption import encrypt, decrypt, encrypt_fields, decrypt_fields

# 단일 필드 암호화
encrypted = encrypt('홍길동')

# 단일 필드 복호화
decrypted = decrypt(encrypted)

# 딕셔너리 필드 암호화
user = {'name': '홍길동', 'age': 30}
encrypted_user = encrypt_fields(user, ['name'])

# 딕셔너리 필드 복호화
decrypted_user = decrypt_fields(encrypted_user, ['name'])
```

---

## 🔑 환경변수 설정

### 프론트엔드 (.env.local)
```bash
# 데이터 암호화 키 (32자 이상 권장)
ENCRYPTION_KEY=zipcheck_v2_encryption_key_change_this_in_production_12345
```

### 백엔드 (services/ai/.env)
```bash
# 데이터 암호화 키 (프론트엔드와 동일한 키 사용)
ENCRYPTION_KEY=zipcheck_v2_encryption_key_change_this_in_production_12345
```

### ⚠️ 프로덕션 키 생성
```bash
# 강력한 랜덤 키 생성 (권장)
openssl rand -base64 32

# 결과 예시
# zX9kP3mN8vQ2wR5tY7uI4oP1aS6dF8gH9jK0lL2mN3xC4vB5nM=
```

---

## 📝 사용 예시

### 회원가입 시 암호화 (프론트엔드)

**현재**: OAuth 로그인 사용 (암호화 불필요)
- Google OAuth는 Supabase Auth에서 자동 처리
- 이름은 `user_metadata`에서 가져옴

**향후**: 이메일/비밀번호 회원가입 추가 시
```typescript
// 회원가입 API
import { encrypt } from '@/lib/encryption';

const response = await fetch('/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify({
    email, // 이메일은 암호화 안 함 (Supabase Auth 관리)
    password, // 비밀번호는 Supabase가 자동 암호화
    name: encrypt(name), // ✅ 이름만 암호화
  }),
});
```

### 문서 업로드 시 암호화 (백엔드)

**파일**: [services/ai/routes/registry.py](services/ai/routes/registry.py:111-113)

```python
from core.encryption import encrypt

# 민감한 데이터 암호화
encrypted_property_address = encrypt(property_address) if property_address else None
encrypted_owner_name = encrypt(owner_name) if owner_name else None

# DB 저장 (암호화된 데이터)
document = create_document(
    property_address=encrypted_property_address,
    owner_info={'name': encrypted_owner_name},
    ...
)
```

### 관리자 페이지에서 복호화 (프론트엔드)

**파일**: [apps/web/app/api/admin/data/route.ts](apps/web/app/api/admin/data/route.ts:66-75)

```typescript
import { decryptFields } from '@/lib/encryption';

// DB에서 암호화된 데이터 가져오기
const { data: documents } = await supabase
  .from('v2_documents')
  .select('*');

// 복호화
const decryptedData = documents.map(item => {
  try {
    return decryptFields(item, ['property_address', 'user']);
  } catch (error) {
    // 복호화 실패 시 원본 반환 (평문 데이터 또는 마이그레이션 전)
    return item;
  }
});
```

---

## 🔄 데이터 마이그레이션

### 기존 평문 데이터 암호화

**파일**: [migrate_encrypt_data.py](migrate_encrypt_data.py)

#### 1️⃣ 환경변수 설정
```bash
# DATABASE_URL (Supabase Postgres URL)
export DATABASE_URL="postgresql://postgres:password@host:5432/postgres"

# ENCRYPTION_KEY (암호화 키)
export ENCRYPTION_KEY="your_encryption_key_here"
```

#### 2️⃣ 마이그레이션 실행
```bash
# 1. 데이터베이스 백업 (필수!)
# Supabase Dashboard → Database → Backups

# 2. 마이그레이션 스크립트 실행
python migrate_encrypt_data.py

# 3. 실행 결과 확인
# ✅ v2_profiles 완료: 10개 암호화, 0개 건너뜀
# ✅ v2_documents 완료: 25개 암호화, 0개 건너뜀
# ✅ v2_contracts 완료: 15개 암호화, 0개 건너뜀
```

#### 3️⃣ 검증
```bash
# Supabase SQL Editor에서 확인
SELECT id, name, email
FROM v2_profiles
LIMIT 5;

# 결과: 암호화된 데이터 (base64 또는 hex 문자열)
# name: "dGVzdA=="  (암호화됨)
# email: "aGVsbG8="  (암호화됨)
```

---

## 🧪 테스트

### 프론트엔드 테스트
```typescript
import { encrypt, decrypt } from '@/lib/encryption';

// 1. 암호화 테스트
const plaintext = '홍길동';
const encrypted = encrypt(plaintext);
console.log('암호화:', encrypted);
// 결과: "f3d1e2a4b5c6:a7b8c9d0e1f2:3g4h5i6j7k8l9m0n"

// 2. 복호화 테스트
const decrypted = decrypt(encrypted);
console.log('복호화:', decrypted);
// 결과: "홍길동"

// 3. 양방향 테스트
console.assert(plaintext === decrypted, '암호화/복호화 실패');
```

### 백엔드 테스트
```python
from core.encryption import encrypt, decrypt

# 1. 암호화 테스트
plaintext = '홍길동'
encrypted = encrypt(plaintext)
print(f'암호화: {encrypted}')
# 결과: "dGVzdA=="

# 2. 복호화 테스트
decrypted = decrypt(encrypted)
print(f'복호화: {decrypted}')
# 결과: "홍길동"

# 3. 양방향 테스트
assert plaintext == decrypted, '암호화/복호화 실패'
```

---

## 🔒 보안 권장사항

### 1️⃣ 키 관리
- **환경변수 보호**: `ENCRYPTION_KEY`는 절대 코드에 하드코딩하지 마세요
- **키 교체**: 정기적인 키 교체 (6개월마다 권장)
- **키 백업**: 안전한 시크릿 관리 시스템 사용 (GCP Secret Manager, AWS Secrets Manager)
- **키 길이**: 최소 32자 이상의 강력한 랜덤 키 사용

### 2️⃣ 암호화 정책
- **알고리즘**: AES-256-GCM (Authenticated Encryption)
- **키 파생**:
  - Python: PBKDF2-HMAC-SHA256 (100,000 iterations)
  - TypeScript: scryptSync
- **Nonce/IV**: 매번 랜덤 생성 (재사용 방지)
- **인증 태그**: GCM 모드로 데이터 무결성 보장

### 3️⃣ 데이터 처리
- **저장**: 암호화된 데이터만 데이터베이스에 저장
- **전송**: HTTPS로만 전송 (TLS 1.3 권장)
- **로깅**: 복호화된 데이터는 로그에 절대 기록 금지
- **백업**: 암호화 키는 별도 안전한 장소에 백업

### 4️⃣ 접근 제어
- **관리자 페이지**: 복호화는 관리자 권한이 있는 사용자만 가능
- **API 보호**: 암호화/복호화 API는 인증된 요청만 허용
- **RLS 정책**: Supabase RLS로 사용자별 데이터 접근 제어

---

## 🚨 트러블슈팅

### 문제 1: "ENCRYPTION_KEY environment variable is not set"

**원인**: 환경변수가 설정되지 않음

**해결**:
```bash
# .env.local 파일에 추가
ENCRYPTION_KEY=your_encryption_key_here

# 또는 환경변수 직접 설정
export ENCRYPTION_KEY="your_encryption_key_here"

# Next.js 서버 재시작 필수!
npm run dev
```

### 문제 2: "Failed to decrypt data"

**원인**:
1. 암호화 키가 변경됨
2. 데이터가 손상됨
3. 평문 데이터를 복호화 시도

**해결**:
1. 환경변수의 `ENCRYPTION_KEY`가 올바른지 확인
2. 데이터베이스 백업에서 복구
3. 마이그레이션 스크립트 재실행

### 문제 3: 관리자 페이지에 이상한 문자열 표시

**원인**: 암호화된 데이터를 복호화하지 않고 표시

**해결**:
1. [apps/web/app/api/admin/data/route.ts](apps/web/app/api/admin/data/route.ts:66)에서 복호화 코드 활성화 확인
2. 브라우저 콘솔에서 에러 확인
3. 서버 로그에서 복호화 에러 확인

---

## 📚 참고 자료

### 관련 파일
- **프론트엔드 암호화**: [apps/web/lib/encryption.ts](apps/web/lib/encryption.ts)
- **백엔드 암호화**: [services/ai/core/encryption.py](services/ai/core/encryption.py)
- **관리자 데이터 API**: [apps/web/app/api/admin/data/route.ts](apps/web/app/api/admin/data/route.ts)
- **관리자 사용자 API**: [apps/web/app/api/admin/users/route.ts](apps/web/app/api/admin/users/route.ts)
- **등기부 업로드 API**: [services/ai/routes/registry.py](services/ai/routes/registry.py)
- **마이그레이션 스크립트**: [migrate_encrypt_data.py](migrate_encrypt_data.py)
- **DB 마이그레이션**: [db/migrations/002_add_encryption_and_profile_trigger.sql](db/migrations/002_add_encryption_and_profile_trigger.sql)

### 보안 가이드
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [NIST SP 800-38D (GCM Mode)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [개인정보보호법 (한국)](https://www.pipc.go.kr/)

---

**마지막 업데이트**: 2025-01-27

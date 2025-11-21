# SSE 스트림 완료 후 리포트 조회 실패 디버깅 리포트

## 문제 요약

채팅 과정에서 유저가 PDF를 업로드하면 SSE 스트림을 통해 LLM이 리포트를 생성하고,
완료 메시지(`done: true`)를 받은 후 프론트엔드에서 리포트를 조회할 때 **404/400 에러**가 발생하는 문제.

---

## 【문제 A: 케이스 소유권 불일치】

### 1. SSE 스트림 완료 시점
**파일**: `services/ai/routes/analysis.py:486-517`

```python
# Line 486-502: INSERT INTO v2_reports
report_response = supabase.table("v2_reports").insert({
    "case_id": case_id,
    "user_id": case['user_id'],  # ← 케이스의 소유자
    "content": final_answer,
    # ...
}).execute()

# Line 511-514: UPDATE v2_cases
supabase.table("v2_cases").update({
    "current_state": "report",
    "updated_at": datetime.utcnow().isoformat(),
}).eq("id", case_id).execute()  # ← user_id 조건 없음!

# Line 517: SSE done 메시지 전송
yield f"data: {json.dumps({'step': 8, 'message': '✅ 분석 완료!', 'progress': 1.0, 'report_id': report_id, 'done': True}, ensure_ascii=False)}\n\n"
```

### 2. 프론트엔드 리포트 조회 시점
**파일**: `apps/web/app/report/[caseId]/page.tsx:120-126`

```typescript
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.done) {
    console.log('분석 완료! 리포트 로딩 시작...');
    eventSource?.close();
    setTimeout(() => {
      loadReport();  // ← 1초 후 /api/report/:caseId GET 요청
    }, 1000);
  }
};
```

### 3. FastAPI 리포트 조회
**파일**: `services/ai/routes/report.py:34-147`

```python
# Line 61-87: Supabase Auth API로 토큰 검증
auth_response = await client.get(
    f"{supabase.supabase_url}/auth/v1/user",
    headers={"Authorization": f"Bearer {token}", ...}
)
user_id = user_data.get("id")

# Line 91-100: v2_cases 조회
case_response = supabase.table("v2_cases") \
    .select("*") \
    .eq("id", case_id) \
    .eq("user_id", user_id) \  # ← user_id 조건!
    .execute()

if not case_response.data:
    raise HTTPException(404, "Case not found")  # ← 404 에러

# Line 105-108: current_state 검증
if case["current_state"] not in ["report"]:
    raise HTTPException(400, f"Report not available...")  # ← 400 에러
```

### 결론 A: 소유권 불일치 가능성

#### ✅ 정상 케이스
- SSE 스트림이 `case["user_id"]`로 리포트 생성
- 토큰의 `user_id`와 `case["user_id"]`가 일치
- v2_cases 조회 성공 (Line 91-95)
- v2_reports 조회 성공 (Line 111-114)

#### ❌ 오류 케이스 1: 토큰 만료
- SSE 완료 후 1초 대기 중 토큰 만료
- Line 76-78: Token validation failed → **401 에러**

#### ❌ 오류 케이스 2: 케이스 소유자 불일치
- SSE 파라미터 `case_id`와 실제 로그인 `user_id` 불일치
- Line 97-99: Case not found → **404 에러**
- RLS는 우회하지만 `WHERE user_id` 조건으로 필터링

---

## 【문제 B: 타이밍 이슈 (Race Condition)】

### 타임라인 분석

```
⏱️ T1: INSERT INTO v2_reports 완료 (services/ai/routes/analysis.py:486-508)
⏱️ T2: UPDATE v2_cases SET current_state='report' 완료 (Line 511-514)
⏱️ T3: SSE done 메시지 전송 (Line 517)
⏱️ T3 + 1000ms: 프론트엔드 리포트 조회 요청 (page.tsx:123-125)
⏱️ T4: FastAPI 리포트 조회 실행 (report.py:105-118)
```

### ✅ 정상 타이밍
```
T1 (INSERT 완료)
  → T2 (UPDATE 완료)
  → T3 (SSE done)
  → T3+1000ms (조회)
  → ✅ 리포트 반환
```

1초 대기로 충분한 시간 확보

### ❌ 오류 타이밍 1: INSERT 지연
```
T1 (INSERT 시작)
  → T3 (SSE done)
  → T3+1000ms (조회)
  → T1 완료 (늦음)
  → ❌ 404 에러
```

- 조회 시점에 v2_reports 레코드 아직 없음
- **가능성**: 낮음 (INSERT는 보통 100ms 이내)

### ❌ 오류 타이밍 2: UPDATE 지연
```
T1 (INSERT 완료)
  → T2 (UPDATE 시작)
  → T3 (SSE done)
  → T3+1000ms (조회)
  → T2 완료 (늦음)
  → ❌ 400 에러
```

- 조회 시점에 `current_state = "parse_enrich"`
- **가능성**: 낮음 (UPDATE도 보통 50ms 이내)

### ❌ 오류 타이밍 3: Supabase 리플리케이션 지연
```
T1 (INSERT 완료)
  → T2 (UPDATE 완료)
  → T3 (SSE done)
  → T3+1000ms (조회)
  → 다른 리플리카에서 읽기
  → ❌ 404 에러
```

- 조회 시 다른 Supabase 리플리카에서 읽음
- 아직 복제 안 된 레코드
- **가능성**: 중간 (Supabase는 eventual consistency)

---

## 【권장 해결 방안】

### 방안 1: SSE 스트림에서 명시적 검증 추가 ⭐ 추천
**위치**: `services/ai/routes/analysis.py:517` 전

```python
# 7단계: 리포트 저장
report_response = supabase.table("v2_reports").insert({...}).execute()

if not report_response.data:
    yield f"data: {json.dumps({'error': '리포트 저장 실패'}, ensure_ascii=False)}\n\n"
    return

report_id = report_response.data[0]['id']

# 8단계: 상태 전환
supabase.table("v2_cases").update({
    "current_state": "report",
    "updated_at": datetime.utcnow().isoformat(),
}).eq("id", case_id).execute()

# ✅ 새로 추가: 검증 단계
# 8-1: v2_reports 재확인
verify_report = supabase.table("v2_reports") \
    .select("id") \
    .eq("id", report_id) \
    .execute()

if not verify_report.data:
    logger.error(f"리포트 검증 실패: {report_id}")
    yield f"data: {json.dumps({'error': '리포트 저장 검증 실패'}, ensure_ascii=False)}\n\n"
    return

# 8-2: v2_cases current_state 재확인
verify_case = supabase.table("v2_cases") \
    .select("current_state") \
    .eq("id", case_id) \
    .execute()

if not verify_case.data or verify_case.data[0]['current_state'] != 'report':
    logger.error(f"케이스 상태 검증 실패: {case_id}")
    yield f"data: {json.dumps({'error': '케이스 상태 전환 실패'}, ensure_ascii=False)}\n\n"
    return

# 완료 (검증 통과 후에만 전송)
yield f"data: {json.dumps({'step': 8, 'message': '✅ 분석 완료!', 'progress': 1.0, 'report_id': report_id, 'done': True}, ensure_ascii=False)}\n\n"
```

**장점**:
- INSERT/UPDATE 완료를 명시적으로 확인
- 리플리케이션 지연 감지 가능
- 사용자에게 정확한 에러 메시지 전달

**단점**:
- 추가 SELECT 쿼리 2회 (성능 영향 미미)

---

### 방안 2: 프론트엔드 재시도 로직 강화 ⭐ 추천
**위치**: `apps/web/app/report/[caseId]/page.tsx:123`

```typescript
// 기존 코드
if (data.done) {
  eventSource?.close();
  setTimeout(() => {
    loadReport();
  }, 1000); // 1초 대기
}

// ✅ 개선 코드
if (data.done) {
  eventSource?.close();

  // 재시도 로직
  const retryLoadReport = async (attempt = 1, maxAttempts = 3) => {
    try {
      await loadReport();
      console.log('리포트 로딩 성공');
    } catch (error: any) {
      if (attempt < maxAttempts && (error.status === 404 || error.status === 400)) {
        console.log(`리포트 로딩 재시도 ${attempt}/${maxAttempts}...`);
        setTimeout(() => {
          retryLoadReport(attempt + 1, maxAttempts);
        }, 2000); // 2초 간격
      } else {
        console.error('리포트 로딩 최종 실패:', error);
        setError('리포트를 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      }
    }
  };

  // 첫 시도는 2초 후
  setTimeout(() => {
    retryLoadReport();
  }, 2000);
}
```

**장점**:
- Supabase 리플리케이션 지연 대응
- 사용자 경험 개선 (자동 재시도)
- 백엔드 수정 불필요

**단점**:
- 최대 6초 대기 (2초 × 3회)

---

### 방안 3: FastAPI current_state 체크 제거 ⚠️ 비추천
**위치**: `services/ai/routes/report.py:105`

```python
# 기존 코드
if case["current_state"] not in ["report"]:
    raise HTTPException(400, f"Report not available. Current state: {case['current_state']}")

# 삭제 또는 주석 처리
# if case["current_state"] not in ["report"]:
#     raise HTTPException(400, ...)
```

**장점**:
- UPDATE 지연에 영향 받지 않음

**단점**:
- 분석 중인 케이스도 리포트 조회 가능 (빈 리포트 반환)
- 보안 취약점 (상태 검증 무시)

---

### 방안 4: 트랜잭션 사용 ⚠️ 복잡함
**위치**: `services/ai/routes/analysis.py:486`

```python
# PostgreSQL 트랜잭션 사용
async with supabase.transaction() as tx:
    # INSERT v2_reports
    report_response = tx.table("v2_reports").insert({...}).execute()

    # UPDATE v2_cases
    tx.table("v2_cases").update({...}).eq("id", case_id).execute()

    # 커밋 (자동)
```

**장점**:
- 원자성 보장 (INSERT + UPDATE 동시 성공/실패)

**단점**:
- Supabase Python 클라이언트가 트랜잭션 미지원 (직접 SQL 작성 필요)
- 구현 복잡도 증가

---

## 【추천 조합】

### 🏆 방안 1 (검증 추가) + 방안 2 (재시도 강화)

#### 안전성: ⭐⭐⭐⭐⭐
- INSERT/UPDATE 완료 명시적 확인
- 리플리케이션 지연 자동 재시도
- 토큰 만료 감지 가능

#### 구현 난이도: ⭐⭐
- 백엔드: SELECT 쿼리 2개 추가 (10줄)
- 프론트엔드: 재시도 로직 추가 (20줄)

#### 사용자 경험: ⭐⭐⭐⭐
- 2~6초 대기 (허용 가능)
- 자동 재시도로 수동 새로고침 불필요
- 명확한 에러 메시지

---

## 디버깅 체크리스트

### A) 케이스 소유권 불일치 확인

1. **SSE 완료 시점 로깅**
   ```python
   # services/ai/routes/analysis.py:508
   logger.info(f"✅ [SSE] 리포트 생성 완료: case_id={case_id}, user_id={case['user_id']}, report_id={report_id}")
   ```

2. **리포트 조회 시점 로깅**
   ```python
   # services/ai/routes/report.py:87
   logger.info(f"✅ [GET /reports/{case_id}] Token validated, user_id={user_id}")
   ```

3. **비교**
   - SSE의 `user_id`와 조회 시 `user_id`가 일치하는가?
   - 불일치 시 → **오류 케이스 2: 케이스 소유자 불일치**

### B) 타이밍 이슈 확인

1. **INSERT 완료 시점 로깅**
   ```python
   # services/ai/routes/analysis.py:508
   logger.info(f"⏱️ [T1] INSERT v2_reports 완료: {datetime.utcnow().isoformat()}")
   ```

2. **UPDATE 완료 시점 로깅**
   ```python
   # services/ai/routes/analysis.py:514
   logger.info(f"⏱️ [T2] UPDATE v2_cases 완료: {datetime.utcnow().isoformat()}")
   ```

3. **SSE done 전송 시점 로깅**
   ```python
   # services/ai/routes/analysis.py:517
   logger.info(f"⏱️ [T3] SSE done 전송: {datetime.utcnow().isoformat()}")
   ```

4. **리포트 조회 요청 시점 로깅**
   ```python
   # services/ai/routes/report.py:49
   logger.info(f"⏱️ [T4] GET /reports/{case_id} 요청: {datetime.utcnow().isoformat()}")
   ```

5. **시간 차이 계산**
   - T4 - T3 < 1000ms → **오류 타이밍 1 또는 2** (INSERT/UPDATE 지연)
   - T4 - T3 ≈ 1000ms, 404 에러 → **오류 타이밍 3** (리플리케이션 지연)

---

## 추가 조사 필요 사항

1. **Supabase 리플리케이션 설정 확인**
   - Eventual consistency 지연 시간
   - Read replica 사용 여부

2. **토큰 만료 시간 확인**
   - JWT 토큰 TTL
   - 리프레시 토큰 정책

3. **에러 로그 수집**
   - 프론트엔드 콘솔 에러
   - Next.js API 라우트 로그
   - FastAPI 로그
   - Supabase 로그

---

## 결론

**가장 가능성 높은 원인**:
1. **Supabase 리플리케이션 지연** (오류 타이밍 3)
2. **케이스 소유자 불일치** (오류 케이스 2)

**권장 해결책**:
- 방안 1 (검증 추가) + 방안 2 (재시도 강화) 조합 적용
- 추가 로깅으로 실제 원인 확인 후 최적화

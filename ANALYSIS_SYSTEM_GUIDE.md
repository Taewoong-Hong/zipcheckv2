# 🏠 집체크 v2 부동산 계약 분석 시스템 구현 가이드

**작성일**: 2025-01-27
**버전**: 1.0.0

---

## 📋 목차

1. [시스템 개요](#-시스템-개요)
2. [완료된 작업](#-완료된-작업)
3. [상태머신 플로우](#-상태머신-플로우)
4. [UI 컴포넌트 사용법](#-ui-컴포넌트-사용법)
5. [다음 구현 단계](#-다음-구현-단계)
6. [데이터 흐름](#-데이터-흐름)
7. [API 엔드포인트](#-api-엔드포인트)
8. [테스트 가이드](#-테스트-가이드)

---

## 🎯 시스템 개요

집체크 v2는 **채팅 기반 부동산 계약 분석 시스템**으로, 다음 단계로 진행됩니다:

```
1. 주소 입력 → 2. 계약유형 선택 → 3. 등기부 발급/업로드 →
4. 데이터 수집 → 5. LLM 분석 → 6. 리포트 제공
```

### 핵심 기능
- ✅ **LLM 비개입 단계**: 1~4단계 (사용자 입력 수집)
- ✅ **공공 데이터 수집**: 건축물대장, 실거래가, 경매 낙찰가
- ✅ **이중 LLM 검증**: ChatGPT 초안 → Claude 교차검증
- ✅ **크레딧 시스템**: 선차감 → 실패 시 자동 환불
- ✅ **리스크 점수화**: 0-100점, 4단계 밴드 (LOW/MID/HIGH/VHIGH)

---

## ✅ 완료된 작업

### 1️⃣ 데이터베이스 스키마 (2025-01-27)

**파일**: [db/migrations/003_chat_analysis_system.sql](db/migrations/003_chat_analysis_system.sql)

**생성된 테이블**:
- `v2_cases` - 분석 케이스 (주소, 계약 유형, 상태)
- `v2_artifacts` - 파일/문서 (등기부, 건축물대장, PDF)
- `v2_reports` - 분석 리포트 (리스크 점수, 요약)
- `v2_credit_transactions` - 크레딧 트랜잭션
- `v2_audit_logs` - 감사 로그
- `v2_public_data_cache` - 공공 데이터 캐시

**헬퍼 함수**:
- `get_user_credit_balance()` - 크레딧 잔액 조회
- `deduct_credits()` - 크레딧 차감 (트랜잭션)
- `refund_credits()` - 크레딧 환불
- `log_audit()` - 감사 로그 기록

**적용 방법**: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) 참조

### 2️⃣ 타입 정의 (TypeScript)

**파일**: [apps/web/types/analysis.ts](apps/web/types/analysis.ts)

**주요 타입**:
```typescript
// 상태
type ChatState = 'init' | 'address_pick' | 'contract_type' | ...

// 계약 유형
type ContractType = '전세' | '전월세' | '월세' | '매매';

// 케이스
interface Case {
  id: string;
  address_road: string;
  contract_type: ContractType;
  state: ChatState;
  ...
}

// 리포트 데이터 (표준 스키마)
interface ReportData {
  registry: RegistryData;
  building: BuildingLedgerData;
  market: MarketData;
  calculations: Calculations;
  risk: RiskAnalysis;
  explainability: ExplainabilityItem[];
  ...
}
```

### 3️⃣ 상태머신 (State Machine)

**파일**: [apps/web/lib/stateMachine.ts](apps/web/lib/stateMachine.ts)

**기능**:
- 상태 전이 검증 (`canTransition`)
- 상태별 프롬프트 메시지
- 진행률 계산 (`getStateProgress`)
- 상태 히스토리 관리
- 이벤트 기반 상태머신 클래스

**사용 예시**:
```typescript
import { StateMachine } from '@/lib/stateMachine';

const sm = new StateMachine('init');

// 상태 전이
sm.transition('address_pick');  // init → address_pick

// 현재 상태 조회
const currentState = sm.getState();  // 'address_pick'

// 진행률
const progress = getStateProgress(currentState);  // 15
```

### 4️⃣ UI 컴포넌트

#### A. 주소 검색 모달 ([AddressSearchModal.tsx](apps/web/components/analysis/AddressSearchModal.tsx))

**기능**:
- 도로명/지번 주소 검색
- 행정안전부 juso API 연동
- 키보드 네비게이션 (↑↓ 화살표, Enter)
- 디바운스 검색 (300ms)
- 드래그 앤 드롭 지원

**Props**:
```typescript
interface AddressSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (address: AddressInfo) => void;
  initialQuery?: string;
}
```

**사용 예시**:
```typescript
const [isModalOpen, setIsModalOpen] = useState(false);

<AddressSearchModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onSelect={(address) => {
    console.log('Selected:', address.road);
    setIsModalOpen(false);
  }}
/>
```

#### B. 계약 유형 선택 ([ContractTypeSelector.tsx](apps/web/components/analysis/ContractTypeSelector.tsx))

**기능**:
- 전세, 전월세, 월세, 매매 4가지 옵션
- 아이콘 + 설명 + 색상 구분
- 선택 시 체크마크 표시
- 호버 효과

**Props**:
```typescript
interface ContractTypeSelectorProps {
  onSelect: (type: ContractType) => void;
  disabled?: boolean;
}
```

**사용 예시**:
```typescript
<ContractTypeSelector
  onSelect={(type) => {
    console.log('Selected:', type);  // '전세' | '전월세' | '월세' | '매매'
  }}
/>
```

#### C. 등기부 선택 ([RegistryChoiceSelector.tsx](apps/web/components/analysis/RegistryChoiceSelector.tsx))

**기능**:
- 발급 요청 (크레딧 차감) vs PDF 업로드
- 크레딧 잔액 표시
- 파일 드래그 앤 드롭
- 크레딧 부족 시 비활성화

**Props**:
```typescript
interface RegistryChoiceSelectorProps {
  onSelect: (method: 'issue' | 'upload', file?: File) => void;
  disabled?: boolean;
  userCredits?: number;         // 사용자 크레딧 잔액
  registryCost?: number;         // 등기부 발급 비용
}
```

**사용 예시**:
```typescript
<RegistryChoiceSelector
  userCredits={50}
  registryCost={10}
  onSelect={(method, file) => {
    if (method === 'issue') {
      console.log('등기부 발급 요청');
    } else {
      console.log('PDF 업로드:', file);
    }
  }}
/>
```

---

## 🔄 상태머신 플로우

### 상태 전이 다이어그램

```
[init] → [address_pick] → [contract_type] → [registry_choice] →
[registry_ready] → [parse_enrich] → [report]
                     ↓
                  [error]
```

### 상태별 UI 표시

| 상태 | 진행률 | UI 컴포넌트 | LLM 관여 |
|------|--------|-------------|---------|
| `init` | 0% | 환영 메시지 + 주소 입력 안내 | ❌ |
| `address_pick` | 15% | `<AddressSearchModal />` | ❌ |
| `contract_type` | 30% | `<ContractTypeSelector />` | ❌ |
| `registry_choice` | 45% | `<RegistryChoiceSelector />` | ❌ |
| `registry_ready` | 60% | PDF 뷰어 (Mozilla PDF.js) | ❌ |
| `parse_enrich` | 80% | 로딩 스피너 + 진행 상태 | ✅ (파싱 보조) |
| `report` | 100% | 채팅 요약 + 상세 리포트 | ✅ (생성/검증) |
| `error` | 0% | 에러 메시지 + 재시작 버튼 | ❌ |

---

## 📱 UI 컴포넌트 사용법

### ChatInterface 통합 예시

```typescript
import { useState } from 'react';
import { StateMachine } from '@/lib/stateMachine';
import AddressSearchModal from '@/components/analysis/AddressSearchModal';
import ContractTypeSelector from '@/components/analysis/ContractTypeSelector';
import RegistryChoiceSelector from '@/components/analysis/RegistryChoiceSelector';
import type { AddressInfo, ContractType } from '@/types/analysis';

export default function AnalysisChatInterface() {
  const [sm] = useState(() => new StateMachine('init'));
  const [currentState, setCurrentState] = useState(sm.getState());

  const [selectedAddress, setSelectedAddress] = useState<AddressInfo | null>(null);
  const [selectedContractType, setSelectedContractType] = useState<ContractType | null>(null);

  // 상태 전이 핸들러
  const handleStateTransition = (nextState: ChatState) => {
    if (sm.transition(nextState)) {
      setCurrentState(sm.getState());
    }
  };

  // 주소 선택 완료
  const handleAddressSelect = (address: AddressInfo) => {
    setSelectedAddress(address);
    handleStateTransition('contract_type');
  };

  // 계약 유형 선택 완료
  const handleContractTypeSelect = (type: ContractType) => {
    setSelectedContractType(type);
    handleStateTransition('registry_choice');
  };

  // 등기부 선택 완료
  const handleRegistrySelect = async (method: 'issue' | 'upload', file?: File) => {
    handleStateTransition('registry_ready');

    // API 호출 (등기부 발급 or 업로드)
    if (method === 'issue') {
      await issueRegistry();
    } else {
      await uploadRegistry(file!);
    }

    handleStateTransition('parse_enrich');
  };

  return (
    <div>
      {/* 진행률 표시 */}
      <ProgressBar value={getStateProgress(currentState)} />

      {/* 상태별 UI */}
      {currentState === 'init' && (
        <WelcomeMessage onStart={() => handleStateTransition('address_pick')} />
      )}

      {currentState === 'address_pick' && (
        <AddressSearchModal
          isOpen={true}
          onClose={() => handleStateTransition('init')}
          onSelect={handleAddressSelect}
        />
      )}

      {currentState === 'contract_type' && (
        <ContractTypeSelector onSelect={handleContractTypeSelect} />
      )}

      {currentState === 'registry_choice' && (
        <RegistryChoiceSelector
          userCredits={50}
          onSelect={handleRegistrySelect}
        />
      )}

      {/* ... 나머지 상태 */}
    </div>
  );
}
```

---

## 🚀 다음 구현 단계

### Phase 1: 백엔드 API 구현 (우선순위 높음)

#### 1️⃣ FastAPI 라우터

**파일 구조**:
```
services/ai/
├─ routes/
│  ├─ chat.py           # 채팅 초기화, 상태 관리
│  ├─ address.py        # 주소 검색 (juso API)
│  ├─ case.py           # 케이스 생성/업데이트
│  ├─ registry.py       # 등기부 발급/업로드/파싱
│  ├─ public_data.py    # 공공 데이터 수집
│  ├─ analysis.py       # 분석 실행 (LLM 라우터)
│  └─ report.py         # 리포트 생성/조회
```

**구현 순서**:
1. `chat.py` - POST /chat/init
2. `case.py` - POST /case, PATCH /case/:id
3. `registry.py` - POST /registry/issue, POST /registry/upload
4. `public_data.py` - POST /fetch/public
5. `analysis.py` - POST /analyze
6. `report.py` - GET /report/:case_id

#### 2️⃣ PDF 파싱 파이프라인

**파일**: `services/ai/core/pdf_parser.py`

```python
from pypdf import PdfReader
from typing import Optional, Tuple

def parse_registry_pdf(pdf_path: str) -> Tuple[dict, float]:
    """
    등기부 PDF 파싱

    Returns:
        (parsed_data, confidence_score)
    """
    try:
        # 1. pypdf 시도
        reader = PdfReader(pdf_path)
        text = "\n".join([page.extract_text() for page in reader.pages])

        # 2. 신뢰도 계산
        confidence = calculate_confidence(text)

        if confidence < 0.7:
            # 3. LLM 보조 (Gemini or ChatGPT)
            return parse_with_llm(text)

        # 4. 구조화
        return structure_registry_data(text), confidence

    except Exception as e:
        # 5. 완전 실패 → LLM 필수
        return parse_with_llm_force(pdf_path)
```

#### 3️⃣ 공공 데이터 수집 어댑터

**파일**: `services/ai/adapters/`

- `building_ledger.py` - 건축물대장 API
- `real_estate_trade.py` - 실거래가 API
- `auction_data.py` - 경매 낙찰가 (RPA)

**예시**:
```python
async def fetch_building_ledger(building_code: str) -> BuildingLedgerData:
    """건축물대장 조회"""
    url = f"http://apis.data.go.kr/...?sigunguCd={building_code[:5]}&bjdongCd={building_code[5:10]}"
    response = await httpx.get(url, params={'serviceKey': API_KEY})

    # 파싱 및 구조화
    return BuildingLedgerData(
        usage=response['mainPurpsCdNm'],
        approval_date=response['useAprDay'],
        ...
    )
```

#### 4️⃣ 규칙 엔진 (Risk Scoring)

**파일**: `services/ai/core/risk_engine.py`

```python
def calculate_risk_score(
    registry: RegistryData,
    market: MarketData,
    contract_type: str
) -> Tuple[int, str, List[str]]:
    """
    리스크 점수 계산

    Returns:
        (score, band, reasons)
    """
    score = 0
    reasons = []

    # 규칙 1: 선순위 채권 비율
    if registry.total_liens / market.estimated_value > 0.85:
        score += 30
        reasons.append("선순위 채권이 추정가치의 85%를 초과합니다")

    # 규칙 2: 전세가율 (전세 계약 시)
    if contract_type == '전세':
        jeonse_ratio = registry.jeonse_amount / market.actual_trades[0].price * 100
        if jeonse_ratio > 90:
            score += 25
            reasons.append(f"전세가율이 {jeonse_ratio:.1f}%로 매우 높습니다")

    # 규칙 3: 위반건축물
    if building.violation:
        score += 15
        reasons.append("위반건축물로 등록되어 있습니다")

    # ... 추가 규칙

    # 밴드 결정
    if score >= 80:
        band = 'VHIGH'
    elif score >= 60:
        band = 'HIGH'
    elif score >= 40:
        band = 'MID'
    else:
        band = 'LOW'

    return score, band, reasons
```

#### 5️⃣ LLM 라우터 (ChatGPT → Claude)

**파일**: `services/ai/core/llm_router.py`

```python
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

async def generate_report_draft(
    registry: RegistryData,
    market: MarketData,
    calculations: dict
) -> dict:
    """ChatGPT로 초안 생성"""
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

    prompt = f"""
너는 부동산 계약 분석 전문가다. 다음 데이터를 바탕으로 분석 리포트를 작성하라:

등기부: {registry}
시장 데이터: {market}
계산 결과: {calculations}

요구사항:
- 채팅형 요약 (5-8줄)
- 설명가능성 (주장 + 근거 + 출처)
- 리스크 요인 (우선순위 순)
- 추천 액션
"""

    response = await llm.ainvoke(prompt)
    return parse_response(response)

async def crosscheck_report(draft: dict) -> dict:
    """Claude로 교차검증"""
    llm = ChatAnthropic(model="claude-sonnet-4", temperature=0.1)

    prompt = f"""
다음은 부동산 계약 분석 리포트 초안이다:

{draft}

다음 항목을 검증하라:
1. 수치 정확성 (계산 오류 체크)
2. 논리 일관성 (모순된 주장 체크)
3. 출처 명시 (근거 없는 주장 체크)
4. 법률 용어 (단정적 표현 지양)

수정사항이 있으면 수정본을 반환하라.
"""

    response = await llm.ainvoke(prompt)
    return parse_crosscheck_response(response)
```

---

### Phase 2: 프론트엔드 통합 (우선순위 중간)

#### 1️⃣ ChatInterface 리팩토링

- 상태머신 통합
- UI 컴포넌트 조건부 렌더링
- API 연동 (Next.js API Routes)

#### 2️⃣ 리포트 렌더러

**파일**: `apps/web/components/analysis/ReportViewer.tsx`

- 채팅형 요약 표시
- 상세 리포트 (표, 차트)
- PDF 다운로드 버튼

#### 3️⃣ 크레딧 시스템 UI

- 크레딧 잔액 표시
- 구매 모달
- 트랜잭션 히스토리

---

### Phase 3: RPA & 자동화 (우선순위 낮음)

#### 1️⃣ 등기부 발급 RPA

**도구**: Selenium or Puppeteer

**워크플로우**:
1. 대법원 인터넷등기소 로그인
2. 주소 검색
3. 등기부 발급 요청
4. PDF 다운로드
5. Supabase Storage 업로드

#### 2️⃣ 경매 낙찰가 RPA

**도구**: Playwright

**워크플로우**:
1. 법원 경매 정보 사이트 접속
2. 주소 기반 검색
3. 낙찰 결과 스크래핑
4. 캐시 저장

---

## 📊 데이터 흐름

### 1️⃣ 전체 파이프라인

```
[사용자 입력] → [주소 수집] → [계약유형] → [등기부 준비]
     ↓
[등기부 파싱] (pypdf → 신뢰도 → LLM 보조)
     ↓
[공공데이터 수집] (건축물대장, 실거래가, 경매)
     ↓
[규칙엔진] (리스크 점수 계산, 전세가율, 협상 포인트)
     ↓
[LLM 라우터] (ChatGPT 초안 → Claude 검증)
     ↓
[리포트 생성] (채팅 요약 + 상세 PDF)
     ↓
[저장 & 제공] (Supabase + 감사 로그)
```

### 2️⃣ 데이터 흐름 시퀀스

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Next.js
  participant API as FastAPI
  participant RPA as RPA Runner
  participant OCR as PDF Parser
  participant DATA as Public APIs
  participant L1 as ChatGPT
  participant L2 as Claude
  participant DB as Supabase

  U->>FE: 주소 입력
  FE->>API: POST /case
  API->>DB: INSERT v2_cases

  U->>FE: 계약유형 선택
  FE->>API: PATCH /case/:id

  U->>FE: 등기부 발급
  FE->>API: POST /registry/issue
  API->>DB: deduct_credits()
  API->>RPA: 발급 요청
  RPA-->>API: PDF URL

  API->>OCR: pypdf 파싱
  alt 신뢰도 낮음
    OCR->>L1: Gemini 보조
  end

  API->>DATA: 공공데이터 조회
  API->>API: 규칙엔진 계산

  API->>L1: 리포트 초안 생성
  API->>L2: 교차검증

  API->>DB: INSERT v2_reports
  API-->>FE: 리포트 반환
  FE-->>U: 채팅 요약 + 다운로드
```

---

## 🔌 API 엔드포인트

### Next.js API Routes (프론트엔드)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/address/search` | GET | 주소 검색 (juso API) |
| `/api/case` | POST | 케이스 생성 |
| `/api/case/:id` | PATCH | 케이스 업데이트 |
| `/api/registry/issue` | POST | 등기부 발급 요청 |
| `/api/registry/upload` | POST | 등기부 PDF 업로드 |
| `/api/analysis/:caseId` | POST | 분석 실행 |
| `/api/report/:caseId` | GET | 리포트 조회 |
| `/api/credits/balance` | GET | 크레딧 잔액 조회 |

### FastAPI (백엔드)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/chat/init` | POST | 채팅 초기화 |
| `/case` | POST | 케이스 생성 |
| `/case/:id` | PATCH | 케이스 업데이트 |
| `/registry/issue` | POST | 등기부 발급 (RPA) |
| `/registry/upload` | POST | 등기부 업로드 |
| `/parse/registry` | POST | 등기부 파싱 |
| `/fetch/public` | POST | 공공 데이터 수집 |
| `/analyze` | POST | 분석 실행 (LLM) |
| `/crosscheck` | POST | 교차검증 (Claude) |
| `/report/:case_id` | GET | 리포트 조회 |

---

## 🧪 테스트 가이드

### 1️⃣ UI 컴포넌트 테스트

```bash
# 주소 검색 모달
npm run dev
# http://localhost:3000에서 테스트
```

**테스트 시나리오**:
1. "강남구 테헤란로" 입력
2. 결과 목록 표시 확인
3. 화살표 키로 네비게이션
4. Enter로 선택
5. 선택된 주소 확인

### 2️⃣ API 테스트

```bash
# 주소 검색 API
curl "http://localhost:3000/api/address/search?q=강남구+테헤란로"

# 예상 응답
{
  "results": [
    {
      "roadAddr": "서울특별시 강남구 테헤란로 123",
      "jibunAddr": "서울특별시 강남구 역삼동 123-45",
      ...
    }
  ],
  "count": 10
}
```

### 3️⃣ 상태머신 테스트

```typescript
import { StateMachine, canTransition } from '@/lib/stateMachine';

describe('StateMachine', () => {
  test('valid transition', () => {
    expect(canTransition('init', 'address_pick')).toBe(true);
  });

  test('invalid transition', () => {
    expect(canTransition('init', 'report')).toBe(false);
  });

  test('state progress', () => {
    expect(getStateProgress('init')).toBe(0);
    expect(getStateProgress('report')).toBe(100);
  });
});
```

---

## 📚 참고 문서

- [CLAUDE.md](CLAUDE.md) - 프로젝트 전체 가이드
- [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) - 데이터베이스 마이그레이션
- [CHAT_SYSTEM_ARCHITECTURE.md](CHAT_SYSTEM_ARCHITECTURE.md) - 채팅 시스템 아키텍처
- [PDF_VIEWER_GUIDE.md](PDF_VIEWER_GUIDE.md) - PDF 뷰어 시스템

---

**마지막 업데이트**: 2025-01-27
**다음 작업**: FastAPI 라우터 구현 시작

/**
 * 집체크 부동산 계약 분석 시스템 타입 정의
 *
 * @description
 * 채팅 기반 부동산 계약 분석 시스템의 핵심 타입들
 * 상태머신, 케이스, 리포트, 크레딧 등 모든 엔티티의 타입 정의
 *
 * @author 집체크 개발팀
 * @version 1.0.0
 * @date 2025-01-27
 */

// ============================================
// 상태머신 (State Machine)
// ============================================

/**
 * 채팅 상태 (State Machine States)
 *
 * @description 분석 프로세스의 상태를 나타냄
 */
export type ChatState =
  | 'init'              // S0. 초기화 - 주소 입력 안내
  | 'address_pick'      // S1. 주소 선택 - juso API 검색/선택
  | 'contract_type'     // S2. 계약 유형 선택 - 전세/전월세/월세/매매
  | 'registry_choice'   // S3. 등기부 선택 - 발급(크레딧) vs 업로드
  | 'registry_ready'    // S4. 등기부 준비 완료 - PDF 뷰어 표시
  | 'parse_enrich'      // S5. 파싱 및 데이터 수집 - 공공 데이터 수집
  | 'report'            // S6. 리포트 생성 완료 - 최종 결과 표시
  | 'error';            // 에러 상태

/**
 * 계약 유형
 */
export type ContractType = '전세' | '전월세' | '월세' | '매매';

/**
 * 등기부 선택 방법
 */
export type RegistryMethod = 'issue' | 'upload';

// ============================================
// 케이스 (Case) - 분석 사례
// ============================================

/**
 * 주소 정보
 */
export interface AddressInfo {
  road: string;                    // 도로명 주소
  lot?: string;                    // 지번 주소
  dong?: string;                   // 동
  ho?: string;                     // 호
  zipCode?: string;                // 우편번호
  buildingCode?: string;           // 건물 코드

  // juso API 응답 원본 (선택)
  jusoDetail?: JusoSearchResult;
}

/**
 * juso API 검색 결과
 */
export interface JusoSearchResult {
  roadAddr: string;                // 도로명 주소
  roadAddrPart1: string;           // 도로명 주소 (참고항목 제외)
  jibunAddr: string;               // 지번 주소
  engAddr: string;                 // 영문 주소
  zipNo: string;                   // 우편번호
  admCd: string;                   // 행정구역 코드
  rnMgtSn: string;                 // 도로명 코드
  bdMgtSn: string;                 // 건물관리번호
  detBdNmList?: string;            // 상세 건물명
  bdNm?: string;                   // 건물명
  bdKdcd?: string;                 // 건물 종류 코드
  siNm: string;                    // 시도명
  sggNm: string;                   // 시군구명
  emdNm: string;                   // 읍면동명
  liNm?: string;                   // 리명
  rn: string;                      // 도로명
  udrtYn: string;                  // 지하 여부
  buldMnnm: number;                // 건물 본번
  buldSlno: number;                // 건물 부번
  mtYn: string;                    // 산 여부
  lnbrMnnm: number;                // 지번 본번
  lnbrSlno: number;                // 지번 부번
  emdNo: string;                   // 읍면동 일련번호
}

/**
 * 케이스 (분석 사례)
 */
export interface Case {
  id: string;
  user_id: string;

  // 주소 정보
  address_road: string;
  address_lot?: string;
  address_dong?: string;
  address_ho?: string;
  address_detail?: AddressInfo;

  // 계약 정보
  contract_type: ContractType;
  contract_amount?: number;        // 보증금 or 매매가 (원)
  monthly_rent?: number;           // 월세 (원)

  // 상태
  state: ChatState;

  // 메타데이터
  flags?: Record<string, any>;
  metadata?: Record<string, any>;

  // 타임스탬프
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// ============================================
// 아티팩트 (Artifact) - 파일/문서
// ============================================

/**
 * 아티팩트 타입
 */
export type ArtifactType =
  | 'registry_pdf'      // 등기부등본 PDF
  | 'building_ledger'   // 건축물대장 PDF
  | 'user_upload'       // 사용자 업로드 파일
  | 'generated_report'; // 생성된 리포트 PDF

/**
 * 파싱 방법
 */
export type ParseMethod = 'pypdf' | 'ocr' | 'llm_gemini' | 'llm_chatgpt';

/**
 * 아티팩트 (파일/문서)
 */
export interface Artifact {
  id: string;
  case_id: string;

  // 파일 정보
  artifact_type: ArtifactType;
  file_path: string;               // Supabase Storage 경로
  file_name: string;
  file_size: number;               // bytes
  mime_type: string;

  // 파싱 정보
  parsed_data?: RegistryData | BuildingLedgerData;
  parse_confidence?: number;       // 0.0 ~ 1.0
  parse_method?: ParseMethod;

  // 메타데이터
  metadata?: Record<string, any>;

  // 타임스탬프
  created_at: string;
  updated_at: string;
}

// ============================================
// 등기부등본 데이터 (Registry Data)
// ============================================

/**
 * 등기부 소유자 정보
 */
export interface RegistryOwner {
  name: string;                    // 소유자 이름 (마스킹)
  share?: string;                  // 지분 (예: "2/1", "단독")
  acquisition_date?: string;       // 취득일
  acquisition_reason?: string;     // 취득 원인 (매매, 증여 등)
}

/**
 * 등기부 권리사항 (근저당, 전세권 등)
 */
export interface RegistryLien {
  type: string;                    // 근저당권, 전세권, 가압류, 압류 등
  amount?: number;                 // 채권최고액 or 전세금 (원)
  priority: 'first' | 'second' | 'third' | 'other';  // 순위
  date: string;                    // 설정일
  creditor?: string;               // 채권자 (은행명 등)
  debtor?: string;                 // 채무자
  notes?: string;                  // 비고
}

/**
 * 등기부등본 파싱 데이터
 */
export interface RegistryData {
  // 갑구 (소유권)
  owners: RegistryOwner[];

  // 을구 (권리사항)
  liens: RegistryLien[];

  // 비고 사항
  notes?: string[];

  // 파싱 신뢰도
  confidence?: number;             // 0.0 ~ 1.0
}

// ============================================
// 건축물대장 데이터 (Building Ledger Data)
// ============================================

/**
 * 건축물대장 파싱 데이터
 */
export interface BuildingLedgerData {
  usage: string;                   // 용도 (공동주택, 단독주택 등)
  approval_date?: string;          // 사용승인일
  total_area?: number;             // 전용면적 (㎡)
  violation: boolean;              // 위반건축물 여부
  parking_count?: number;          // 주차 대수
  floor_area_ratio?: number;       // 용적률 (%)
  building_coverage_ratio?: number; // 건폐율 (%)
  notes?: string[];
}

// ============================================
// 공공 데이터 (Public Data)
// ============================================

/**
 * 실거래가 정보
 */
export interface RealEstateTrade {
  date: string;                    // 거래일 (YYYY-MM-DD)
  price: number;                   // 거래가 (원)
  area?: number;                   // 면적 (㎡)
  floor?: number;                  // 층
  built_year?: number;             // 건축 연도
  deal_type?: '매매' | '전세' | '월세';
}

/**
 * 유사 매물 정보
 */
export interface SimilarProperty {
  address: string;
  price: number;                   // 거래가 (원)
  distance_m: number;              // 거리 (m)
  area?: number;                   // 면적 (㎡)
  built_year?: number;             // 건축 연도
  date?: string;                   // 거래일
}

/**
 * 경매 낙찰가 정보
 */
export interface AuctionData {
  date: string;                    // 낙찰일
  final_bid: number;               // 낙찰가 (원)
  appraisal_value?: number;        // 감정가 (원)
  ratio?: number;                  // 낙찰률 (%)
  case_number?: string;            // 사건번호
}

/**
 * 시장 데이터
 */
export interface MarketData {
  actual_trades: RealEstateTrade[];     // 실거래가 (최근 6개월)
  comps: SimilarProperty[];             // 유사 매물 (반경 500m)
  auctions: AuctionData[];              // 경매 낙찰가 (최근 1년)
}

// ============================================
// 리포트 (Report)
// ============================================

/**
 * 리스크 밴드
 */
export type RiskBand = 'LOW' | 'MID' | 'HIGH' | 'VHIGH';

/**
 * 전세가율 분석 (전세 계약 시)
 */
export interface JeonseAnalysis {
  jeonse_ratio: number;            // 전세가율 (%)
  ratio_band: string;              // 구간 라벨 (예: "60% 이하 (안전)")
  warning?: string;                // 경고 메시지
}

/**
 * 협상 포인트 (매매 계약 시)
 */
export interface NegotiationPoint {
  title: string;                   // 포인트 제목
  description: string;             // 설명
  priority: 'high' | 'medium' | 'low';  // 우선순위
}

/**
 * 회수 시나리오 (경매 시 회수 가능성)
 */
export interface RecoveryScenario {
  case: string;                    // 시나리오명 (예: "경매")
  expected_recovery_ratio: number; // 예상 회수율 (%)
  assumptions: string;             // 가정 사항
}

/**
 * 계산 결과
 */
export interface Calculations {
  jeonse_ratio?: number;           // 전세가율 (전세 계약 시)
  negotiation_points?: NegotiationPoint[];  // 협상 포인트 (매매 계약 시)
  recovery_scenarios?: RecoveryScenario[];  // 회수 시나리오
}

/**
 * 리스크 분석
 */
export interface RiskAnalysis {
  score: number;                   // 리스크 점수 (0-100)
  band: RiskBand;                  // 리스크 밴드
  top_reasons: string[];           // 주요 리스크 요인
}

/**
 * 설명가능성 (Explainability)
 */
export interface ExplainabilityItem {
  claim: string;                   // 주장/결론
  why: string;                     // 근거
  sources: string[];               // 출처
}

/**
 * 데이터 출처
 */
export interface DataSource {
  name: string;                    // 출처명 (예: "건축물대장")
  url?: string;                    // URL
  ts: string;                      // 조회 시간
}

/**
 * 리포트 전체 데이터 (표준 스키마)
 */
export interface ReportData {
  // 메타데이터
  meta: {
    case_id: string;
    ts: string;                    // ISO 8601 타임스탬프
  };

  // 대상 정보
  subject: {
    address: AddressInfo;
    contract_type: ContractType;
    contract_amount?: number;
    monthly_rent?: number;
  };

  // 등기부 분석
  registry: RegistryData & {
    confidence: number;            // 파싱 신뢰도
  };

  // 건축물대장 분석
  building: BuildingLedgerData;

  // 시장 데이터
  market: MarketData;

  // 계산 결과
  calculations: Calculations;

  // 리스크 분석
  risk: RiskAnalysis;

  // 설명가능성
  explainability: ExplainabilityItem[];

  // 최종 요약 (채팅형)
  final_summary: string;

  // 추천 액션
  next_actions: string[];

  // 데이터 출처
  sources: DataSource[];
}

/**
 * 리포트 (DB 저장용)
 */
export interface Report {
  id: string;
  case_id: string;
  version: number;

  // 리포트 데이터
  report_data: ReportData;

  // 요약 (빠른 조회용)
  final_summary: string;
  risk_score: number;
  risk_band: RiskBand;

  // LLM 추적
  llm_model_draft?: string;
  llm_model_review?: string;
  llm_tokens_used?: number;

  // 메타데이터
  generation_time_ms?: number;
  metadata?: Record<string, any>;

  // 타임스탬프
  created_at: string;
}

// ============================================
// 크레딧 (Credit)
// ============================================

/**
 * 크레딧 트랜잭션 타입
 */
export type CreditTransactionType =
  | 'purchase'          // 구매
  | 'deduct'            // 차감
  | 'refund'            // 환불
  | 'bonus'             // 보너스
  | 'expire';           // 만료

/**
 * 크레딧 트랜잭션
 */
export interface CreditTransaction {
  id: string;
  user_id: string;
  case_id?: string;

  // 트랜잭션 정보
  transaction_type: CreditTransactionType;
  amount: number;                  // 음수: 차감, 양수: 증가
  balance_after: number;           // 트랜잭션 후 잔액

  // 사유
  reason: string;
  reason_code?: string;

  // 메타데이터
  metadata?: Record<string, any>;

  // 타임스탬프
  created_at: string;
}

// ============================================
// 감사 로그 (Audit Log)
// ============================================

/**
 * 감사 로그 카테고리
 */
export type AuditEventCategory =
  | 'case'              // 케이스 관련
  | 'registry'          // 등기부 관련
  | 'parsing'           // 파싱 관련
  | 'data_collection'   // 데이터 수집
  | 'llm'               // LLM 호출
  | 'report'            // 리포트 생성
  | 'credit'            // 크레딧 관련
  | 'error';            // 에러

/**
 * 로그 심각도
 */
export type LogSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

/**
 * 감사 로그
 */
export interface AuditLog {
  id: string;
  user_id?: string;
  case_id?: string;

  // 이벤트 정보
  event_type: string;
  event_category: AuditEventCategory;
  message: string;
  severity: LogSeverity;

  // 메타데이터
  metadata?: Record<string, any>;

  // 타임스탬프
  created_at: string;
}

// ============================================
// API 요청/응답 타입
// ============================================

/**
 * 채팅 초기화 요청
 */
export interface InitChatRequest {
  plan?: string;                   // 분석 플랜 (선택)
  flags?: Record<string, any>;     // 플래그
}

/**
 * 채팅 초기화 응답
 */
export interface InitChatResponse {
  case_id: string;
  state: ChatState;
  message: string;                 // "집 주소를 입력해주세요"
}

/**
 * 주소 검색 요청
 */
export interface AddressSearchRequest {
  query: string;                   // 검색 키워드
}

/**
 * 주소 검색 응답
 */
export interface AddressSearchResponse {
  results: JusoSearchResult[];
  count: number;
}

/**
 * 케이스 생성/업데이트 요청
 */
export interface UpdateCaseRequest {
  case_id: string;
  address?: AddressInfo;
  contract_type?: ContractType;
  contract_amount?: number;
  monthly_rent?: number;
}

/**
 * 등기부 업로드 요청
 */
export interface UploadRegistryRequest {
  case_id: string;
  file: File;
}

/**
 * 등기부 업로드 응답
 */
export interface UploadRegistryResponse {
  artifact_id: string;
  file_size: number;
  parse_confidence?: number;
}

/**
 * 분석 진행 상태
 */
export interface AnalysisProgress {
  case_id: string;
  state: ChatState;
  progress: number;                // 0-100
  current_task?: string;           // 현재 작업 (예: "등기부 파싱 중...")
  error?: string;
}

// riskEngine.ts

export type Grade = "위험" | "주의" | "보통" | "양호" | "안전";

// ===========================
// 낙찰가율 자동 결정 (MVP용)
// ===========================
export type PropertyType = "아파트" | "빌라" | "단독주택";

// 서울 강남6구
const SEOUL_GANGNAM6 = new Set(["강남구", "서초구", "송파구", "마포구", "용산구", "성동구"]);

// 경기 동남부권
const GYEONGGI_SOUTHEAST = new Set([
  "성남시", "성남시 분당구", "용인시", "용인시 수지구", "용인시 기흥구", "용인시 처인구",
  "수원시", "수원시 영통구", "수원시 팔달구", "수원시 권선구", "수원시 장안구",
  "화성시", "평택시", "오산시", "안성시", "이천시", "여주시", "하남시", "광주시",
]);

// 경기 서북부권
const GYEONGGI_NORTHWEST = new Set([
  "고양시", "고양시 일산동구", "고양시 일산서구", "고양시 덕양구",
  "파주시", "김포시", "의정부시", "양주시", "동두천시", "연천군"
]);

/**
 * 초기 MVP용 한국 낙찰가율 고정값 로직
 *
 * @param propertyType 물건 종류 ("아파트" | "빌라" | "단독주택")
 * @param sido 시도 (예: "서울특별시", "경기도", "부산광역시")
 * @param sigungu 시군구 (예: "강남구", "수원시 영통구")
 * @returns 낙찰가율 (0.0~1.0)
 *
 * 낙찰가율 규칙:
 * 1) 아파트:
 *    - 서울 강남6구: 90%
 *    - 서울 기타: 85%
 *    - 경기 동남부: 80%
 *    - 경기 서북부: 75%
 *    - 기타 경기: 75%
 *    - 그 외 지방: 70%
 *
 * 2) 빌라/다세대/단독주택:
 *    - 수도권 (서울/경기/인천): 70%
 *    - 지방: 60%
 */
export function getDefaultAuctionRate(
  propertyType: PropertyType,
  sido: string,
  sigungu: string
): number {
  const sidoTrimmed = sido.trim();
  const sigunguTrimmed = sigungu.trim();

  // 1) 아파트
  if (propertyType === "아파트") {
    // 서울
    if (sidoTrimmed.includes("서울")) {
      if (SEOUL_GANGNAM6.has(sigunguTrimmed)) {
        return 0.90;
      }
      return 0.85;
    }

    // 경기도
    if (sidoTrimmed.includes("경기")) {
      if (GYEONGGI_SOUTHEAST.has(sigunguTrimmed)) {
        return 0.80;
      }
      if (GYEONGGI_NORTHWEST.has(sigunguTrimmed)) {
        return 0.75;
      }
      // 그 밖의 경기 지역은 일단 0.75로 처리 (MVP 기준, 나중에 테이블화 가능)
      return 0.75;
    }

    // 그 외 지방
    return 0.70;
  }

  // 2) 빌라/다세대/단독
  if (propertyType === "빌라" || propertyType === "단독주택") {
    // 수도권: 서울/경기/인천
    if (
      sidoTrimmed.includes("서울") ||
      sidoTrimmed.includes("경기") ||
      sidoTrimmed.includes("인천")
    ) {
      return 0.70;
    }
    // 지방
    return 0.60;
  }

  // 기본값 (혹시 타입 누락 시)
  return 0.70;
}

export interface RentRiskInput {
  // 가격/보증금 정보
  deposit: number;             // 임대차 보증금
  monthlyRent: number;         // 0이면 전세, >0이면 월세/반전세
  recentRealPrice: number;     // 최근 실거래가 (물건 시가 추정치)
  defectAmount: number;        // 권리상 하자 금액 (선순위 근저당, 압류, 미납세금 등 회수 불가 추정치)

  // 낙찰가율 (자동 결정 또는 수동 지정)
  auctionRate?: number;        // 지역 평균 낙찰가율 (0.8 = 80%) - 레거시 호환용, 선택적
  propertyType?: PropertyType; // 물건 종류 (아파트/빌라/단독주택) - 자동 결정용
  sido?: string;               // 시도 (예: "서울특별시", "경기도") - 자동 결정용
  sigungu?: string;            // 시군구 (예: "강남구", "수원시 영통구") - 자동 결정용
  auctionRateOverride?: number; // 수동 낙찰가율 지정 (0.0~1.0) - 최우선 적용

  // 등기부 정보
  seniorRightsAmount: number;  // 선순위 권리 합계
  hasSeizure?: boolean;        // 압류
  hasProvisionalSeizure?: boolean; // 가압류/가처분
  hasTaxArrears?: boolean;     // 국세/지방세 체납

  // 건축물대장
  isIllegalBuilding?: boolean; // 위반건축물 여부
}

export interface SaleRiskInput {
  // 가격 정보
  contractPrice: number;   // 매매 계약금액
  fairPrice3m: number;     // 최근 3개월 적정 시세(필터링된 실거래 기준)

  // 지역 경쟁력 점수들 (0~100)
  schoolScore: number;           // 학군
  jobDemandScore: number;        // 직장 수요
  tradeLiquidityScore: number;   // 실거래 빈도/유동성
  growthScore: number;           // 장기 시세 상승률 기반 점수

  // 공통 안전성 정보 (선택사항)
  safetyScore?: number;          // 등기부/건축물 기반 안전 점수
}

export interface RentRiskResult {
  safetyScore: number;
  grade: Grade;
  flags: string[];
  reasons: string[];
  depositRatio: number;
  objectValue: number;
  seniorRatio: number;
}

export interface SaleRiskResult {
  investmentScore: number;
  grade: Grade;
  priceGapRatio: number;
  flags: string[];
  reasons: string[];
}

function clamp(value: number, minValue: number = 0, maxValue: number = 100): number {
  return Math.max(minValue, Math.min(maxValue, value));
}

function gradeFromScore(score: number): Grade {
  if (score >= 80) return "안전";
  if (score >= 60) return "양호";
  if (score >= 40) return "보통";
  if (score >= 20) return "주의";
  return "위험";
}

// -----------------------------
// 1) 임대차 안전 점수 엔진
// -----------------------------
export function calculateRentSafety(input: RentRiskInput): RentRiskResult {
  const reasons: string[] = [];
  const flags: string[] = [];

  const hasSeizure = input.hasSeizure ?? false;
  const hasProvisionalSeizure = input.hasProvisionalSeizure ?? false;
  const hasTaxArrears = input.hasTaxArrears ?? false;
  const isIllegalBuilding = input.isIllegalBuilding ?? false;

  // 낙찰가율 결정 (우선순위: auctionRateOverride > propertyType+sido+sigungu > auctionRate > 기본값 70%)
  let finalAuctionRate = 0.70; // 기본값

  if (input.auctionRateOverride !== undefined) {
    // 우선순위 1: 수동 지정값
    finalAuctionRate = input.auctionRateOverride;
  } else if (input.propertyType && input.sido && input.sigungu) {
    // 우선순위 2: 자동 결정
    finalAuctionRate = getDefaultAuctionRate(input.propertyType, input.sido, input.sigungu);
  } else if (input.auctionRate !== undefined) {
    // 우선순위 3: 레거시 파라미터
    finalAuctionRate = input.auctionRate;
  }

  // 1. 물건 가치 계산: (실거래가 - 권리상 하자 금액) * 낙찰가율
  const baseValue = Math.max(0, input.recentRealPrice - input.defectAmount);
  const objectValue = baseValue * finalAuctionRate;

  // 2. 보증금 / 물건가치 비율
  const depositRatio = objectValue > 0 ? input.deposit / objectValue : 10.0;

  // 3. 선순위 권리 비율 (실거래가 대비)
  const seniorRatio =
    input.recentRealPrice > 0 ? input.seniorRightsAmount / input.recentRealPrice : 0.0;

  let score = 100;

  // (A) 보증금 비율에 따른 감점
  if (depositRatio <= 0.7) {
    reasons.push("보증금이 물건 가치의 70% 이하로 비교적 안전한 수준입니다.");
  } else if (depositRatio <= 0.9) {
    score -= 15;
    reasons.push("보증금이 물건 가치의 70~90% 구간으로 다소 높은 편입니다.");
  } else if (depositRatio <= 1.0) {
    score -= 35;
    flags.push("보증금이 물건 가치의 90% 이상");
    reasons.push("보증금이 물건 가치의 90~100% 수준으로 경매 시 회수 위험이 있습니다.");
  } else {
    score -= 60;
    flags.push("보증금이 물건 가치 초과(깡통 위험)");
    reasons.push("보증금이 물건 가치보다 커 전세사기·깡통전세 위험이 큽니다.");
  }

  // (B) 선순위 권리 과다 여부
  if (seniorRatio > 0.6) {
    score -= 20;
    flags.push("선순위 권리 과다");
    reasons.push("실거래가 대비 선순위 권리 비율이 60%를 초과하여 매우 높은 편입니다.");
  } else if (seniorRatio > 0.4) {
    score -= 10;
    reasons.push("실거래가 대비 선순위 권리 비율이 40~60% 구간으로 높은 편입니다.");
  }

  // (C) 압류/가압류/체납 등 리스크 플래그
  if (hasSeizure) {
    score -= 10;
    flags.push("압류 존재");
    reasons.push("등기부에 압류가 기재되어 있어 채무 불이행 위험이 존재합니다.");
  }
  if (hasProvisionalSeizure) {
    score -= 10;
    flags.push("가압류/가처분 존재");
    reasons.push("등기부에 가압류 또는 가처분이 있어 권리관계 변동 가능성이 큽니다.");
  }
  if (hasTaxArrears) {
    score -= 10;
    flags.push("국세/지방세 체납");
    reasons.push("국세 또는 지방세 체납이 있어 선순위로 공제될 위험이 있습니다.");
  }

  // (D) 위반건축물 여부
  if (isIllegalBuilding) {
    score -= 20;
    flags.push("위반건축물");
    reasons.push("위반건축물로 분류되어 향후 처분·대출·경매 시 불리할 수 있습니다.");
  }

  const safetyScore = clamp(score, 0, 100);
  const grade = gradeFromScore(safetyScore);

  return {
    safetyScore,
    grade,
    flags,
    reasons,
    depositRatio,
    objectValue,
    seniorRatio,
  };
}

// -----------------------------
// 2) 매매 투자 점수 엔진
// -----------------------------
export function calculateSaleInvestment(input: SaleRiskInput): SaleRiskResult {
  const reasons: string[] = [];
  const flags: string[] = [];

  // 1. 가격 괴리율: (계약가 - 적정시세) / 적정시세
  const priceGapRatio =
    input.fairPrice3m > 0
      ? (input.contractPrice - input.fairPrice3m) / input.fairPrice3m
      : 0;

  let investmentScore = 0;

  // (A) 가격 괴리에 따른 점수
  if (priceGapRatio <= -0.1) {
    investmentScore += 30;
    reasons.push("최근 3개월 시세 대비 10% 이상 저렴하게 매수하는 조건입니다.");
  } else if (priceGapRatio <= -0.05) {
    investmentScore += 20;
    reasons.push("최근 3개월 시세 대비 5~10% 정도 저렴하게 매수하는 조건입니다.");
  } else if (priceGapRatio <= 0.05) {
    investmentScore += 10;
    reasons.push("최근 3개월 시세 대비 ±5% 이내의 적정 수준에서 매수하는 조건입니다.");
  } else if (priceGapRatio <= 0.15) {
    reasons.push("최근 3개월 시세 대비 5~15% 정도 높은 가격으로 매수하려는 조건입니다.");
  } else {
    investmentScore -= 10;
    flags.push("고가 매수 위험");
    reasons.push("최근 3개월 시세 대비 15% 이상 높은 가격으로 매수하려는 조건입니다.");
  }

  // (B) 지역 경쟁력/성장성 점수 (0~100을 가중 평균한 뒤 0.5 배수)
  const baseScore =
    0.3 * input.schoolScore +
    0.3 * input.jobDemandScore +
    0.2 * input.tradeLiquidityScore +
    0.2 * input.growthScore;

  investmentScore += (baseScore * 0.5) / 1.0;

  // (C) 안전 점수(선택) 반영
  if (typeof input.safetyScore === "number") {
    if (input.safetyScore < 40) {
      investmentScore -= 15;
      flags.push("권리/안전 리스크");
      reasons.push("등기부·건축물대장 기준 안전 점수가 낮아 권리·안전 리스크가 존재합니다.");
    } else if (input.safetyScore < 60) {
      investmentScore -= 5;
      reasons.push("안전 점수가 보통 수준으로 일부 리스크를 고려할 필요가 있습니다.");
    }
  }

  const finalScore = clamp(investmentScore, 0, 100);
  const grade = gradeFromScore(finalScore);

  return {
    investmentScore: finalScore,
    grade,
    priceGapRatio,
    flags,
    reasons,
  };
}

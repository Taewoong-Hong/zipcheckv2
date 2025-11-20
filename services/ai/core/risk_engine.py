"""
규칙 엔진 (Risk Engine)

부동산 계약 리스크 점수 계산 및 협상 포인트 추출

- 임대차 (전세/월세): 전세가율, 선순위 채권 중심
- 매매: 가격 적정성, 시세 상승 가치 중심 (등기부 선택적)
"""
from typing import Dict, List, Optional
from pydantic import BaseModel


# ===========================
# Data Models
# ===========================
class ContractData(BaseModel):
    """계약서 데이터"""
    contract_type: str  # "매매" | "전세" | "월세"
    price: Optional[int] = None  # 계약 금액 (만원) - 매매가 or 전세보증금
    deposit: Optional[int] = None  # 보증금 (만원) - 월세용
    monthly_rent: Optional[int] = None  # 월세 (만원)
    special_terms: Optional[str] = None  # 특약사항

    # 매매 전용 필드
    property_address: Optional[str] = None  # 주소 (매매 필수)

    # 낙찰가율 자동 결정용 필드 (임대차 전용)
    property_type: Optional["PropertyType"] = None  # 물건 종류 (아파트/빌라/단독주택)
    sido: Optional[str] = None  # 시도 (예: "서울특별시", "경기도")
    sigungu: Optional[str] = None  # 시군구 (예: "강남구", "수원시 영통구")
    auction_rate_override: Optional[float] = None  # 수동 낙찰가율 지정 (0.0~1.0)


class RegistryData(BaseModel):
    """등기부 데이터 (선택적)"""
    property_value: Optional[int] = None  # 공시지가/감정가 (만원)
    mortgage_total: Optional[int] = None  # 총 근저당 합계 (만원)
    seizure_exists: bool = False  # 압류 여부
    provisional_attachment_exists: bool = False  # 가압류 여부
    ownership_disputes: bool = False  # 소유권 분쟁 여부
    lease_rights_exists: bool = False  # 전세권 설정 여부 (매매 시 명도 이슈)


class MarketData(BaseModel):
    """시장 데이터 (매매 전용)"""
    avg_trade_price: Optional[int] = None  # 평균 실거래가 (만원)
    recent_trades: List[dict] = []  # 최근 거래 내역
    avg_price_per_pyeong: Optional[int] = None  # 평당 평균가 (만원)


class PropertyValueAssessment(BaseModel):
    """부동산 가치 평가 (LLM 기반, 매매 전용)"""
    school_score: int = 0  # 학군 점수 (0~15, 낮을수록 좋음)
    school_reason: str = ""
    supply_score: int = 0  # 공급 과잉 점수 (0~15, 낮을수록 좋음)
    supply_reason: str = ""
    job_score: int = 0  # 직장 수요 점수 (0~10, 낮을수록 좋음)
    job_reason: str = ""
    total_score: int = 0  # 총점 (0~40, 낮을수록 좋음)
    summary: str = ""


class RiskScore(BaseModel):
    """리스크 점수"""
    total_score: float  # 0~100 (낮을수록 안전)
    jeonse_ratio: Optional[float] = None  # 전세가율 (%)
    mortgage_ratio: Optional[float] = None  # 근저당 비율 (%)
    risk_level: str  # "안전" | "주의" | "위험" | "심각"
    risk_factors: List[str]  # 위험 요인 리스트

    # 매매 전용 세부 점수 (선택적)
    price_fairness_score: Optional[int] = None
    property_value_score: Optional[int] = None
    legal_risk_score: Optional[int] = None

    # 부동산 가치 평가 세부 정보 (선택적)
    school_score: Optional[int] = None
    school_reason: Optional[str] = None
    supply_score: Optional[int] = None
    supply_reason: Optional[str] = None
    job_score: Optional[int] = None
    job_reason: Optional[str] = None
    property_value_summary: Optional[str] = None

    # 임대차 전용 세부 점수 (선택적)
    jeonse_ratio_score: Optional[int] = None
    mortgage_ratio_score: Optional[int] = None
    encumbrance_score: Optional[int] = None


class NegotiationPoint(BaseModel):
    """협상 포인트"""
    category: str  # "가격" | "특약" | "권리관계"
    point: str  # 협상 포인트 설명
    impact: str  # "높음" | "중간" | "낮음"


class RegistryRiskFeatures(BaseModel):
    """
    등기부 리스크 특징 (코드로 100% 계산, LLM 사용 안 함)

    LLM은 이 JSON을 읽고 '해석/설명/추천'만 하면 됨
    """
    # 기본 정보
    property_address: Optional[str] = None
    building_type: Optional[str] = None
    area_m2: Optional[float] = None

    # 소유권 정보 (마스킹)
    owner_count: int = 0
    owner_names_masked: List[str] = []

    # 근저당권 분석
    mortgage_count: int = 0
    total_mortgage_amount: int = 0  # 만원
    max_mortgage_ltv: Optional[float] = None  # 최대 근저당 LTV (%)
    mortgage_creditors: List[str] = []  # 채권자 목록 (기업명만)

    # 압류/가압류/가처분
    has_seizure: bool = False  # 압류
    has_provisional_attachment: bool = False  # 가압류
    has_provisional_disposition: bool = False  # 가처분
    seizure_count: int = 0
    seizure_total_amount: int = 0  # 만원

    # 질권
    pledge_count: int = 0
    pledge_total_amount: int = 0  # 만원

    # 전세권
    lease_right_count: int = 0
    lease_right_total_amount: int = 0  # 만원

    # 리스크 지표 (계산된 값)
    jeonse_ratio: Optional[float] = None  # 전세가율 (%)
    mortgage_ratio: Optional[float] = None  # 근저당 비율 (%)
    total_encumbrance_ratio: Optional[float] = None  # 총 부담 비율 (%)

    # 위험도 레벨 (규칙 기반 판정)
    risk_level: str = "안전"  # "안전" | "주의" | "위험" | "심각"
    risk_score: float = 0.0  # 0~100 (낮을수록 안전)

    # 세부 점수 (임대차 전용)
    jeonse_ratio_score: Optional[int] = None
    mortgage_ratio_score: Optional[int] = None
    encumbrance_score: Optional[int] = None


class RiskAnalysisResult(BaseModel):
    """리스크 분석 결과"""
    risk_score: RiskScore
    negotiation_points: List[NegotiationPoint]
    recommendations: List[str]


# ===========================
# 낙찰가율 자동 결정 함수 (MVP용)
# ===========================
from enum import Enum


class PropertyType(str, Enum):
    """물건 종류"""
    APT = "아파트"
    VILLA = "빌라"
    DETACHED = "단독주택"


# 서울 강남6구
SEOUL_GANGNAM6 = {"강남구", "서초구", "송파구", "마포구", "용산구", "성동구"}

# 경기 동남부권
GYEONGGI_SOUTHEAST = {
    "성남시", "성남시 분당구", "용인시", "용인시 수지구", "용인시 기흥구", "용인시 처인구",
    "수원시", "수원시 영통구", "수원시 팔달구", "수원시 권선구", "수원시 장안구",
    "화성시", "평택시", "오산시", "안성시", "이천시", "여주시", "하남시", "광주시",
}

# 경기 서북부권
GYEONGGI_NORTHWEST = {
    "고양시", "고양시 일산동구", "고양시 일산서구", "고양시 덕양구",
    "파주시", "김포시", "의정부시", "양주시", "동두천시", "연천군"
}


def get_default_auction_rate(
    property_type: PropertyType,
    sido: str,
    sigungu: str
) -> float:
    """
    초기 MVP용 한국 낙찰가율 고정값 로직

    Args:
        property_type: 물건 종류 (APT, VILLA, DETACHED)
        sido: 시도 (예: "서울특별시", "경기도", "부산광역시")
        sigungu: 시군구 (예: "강남구", "수원시 영통구")

    Returns:
        낙찰가율 (0.0~1.0)

    낙찰가율 규칙:
    1) 아파트:
       - 서울 강남6구: 90%
       - 서울 기타: 85%
       - 경기 동남부: 80%
       - 경기 서북부: 75%
       - 기타 경기: 75%
       - 그 외 지방: 70%

    2) 빌라/다세대/단독주택:
       - 수도권 (서울/경기/인천): 70%
       - 지방: 60%
    """
    sido = sido.strip()
    sigungu = sigungu.strip()

    # 1) 아파트
    if property_type == PropertyType.APT:
        # 서울
        if "서울" in sido:
            if sigungu in SEOUL_GANGNAM6:
                return 0.90
            return 0.85

        # 경기도
        if "경기도" in sido or "경기" in sido:
            if sigungu in GYEONGGI_SOUTHEAST:
                return 0.80
            if sigungu in GYEONGGI_NORTHWEST:
                return 0.75
            # 그 밖의 경기 지역은 일단 0.75로 처리 (MVP 기준, 나중에 테이블화 가능)
            return 0.75

        # 그 외 지방
        return 0.70

    # 2) 빌라/다세대/단독
    if property_type in {PropertyType.VILLA, PropertyType.DETACHED}:
        # 수도권: 서울/경기(+ 인천 가정)
        if "서울" in sido or "경기도" in sido or "경기" in sido or "인천" in sido:
            return 0.70
        # 지방
        return 0.60

    # 기본값 (혹시 타입 누락 시)
    return 0.70


# ===========================
# 규칙 엔진 함수 (공통)
# ===========================
def calculate_jeonse_ratio(deposit: int, property_value: int) -> float:
    """
    전세가율 계산

    전세가율 = (전세 보증금 / 공시지가) * 100

    - 70% 이하: 안전
    - 70~80%: 주의
    - 80~90%: 위험
    - 90% 이상: 심각
    """
    if property_value == 0:
        return 0.0
    return (deposit / property_value) * 100


def calculate_mortgage_ratio(mortgage_total: int, property_value: int) -> float:
    """
    근저당 비율 계산

    근저당 비율 = (총 근저당 / 공시지가) * 100
    """
    if property_value == 0:
        return 0.0
    return (mortgage_total / property_value) * 100


# ===========================
# 매매 리스크 엔진 함수
# ===========================
def calculate_price_premium(
    contract_price: int,
    avg_trade_price: Optional[int]
) -> tuple[float, int]:
    """
    가격 적정성 분석 (매매 전용)

    계약가 vs 평균 실거래가 비교
    - 프리미엄 = (계약가 - 평균가) / 평균가 * 100

    점수 (0~40점, 낮을수록 좋음):
    - 프리미엄 <-10%: 0점 (매우 적정)
    - 프리미엄 -10~0%: 10점 (적정)
    - 프리미엄 0~10%: 20점 (주의)
    - 프리미엄 10~20%: 30점 (위험)
    - 프리미엄 >20%: 40점 (심각)
    """
    if not avg_trade_price or avg_trade_price == 0:
        return 0.0, 20  # 데이터 없으면 중립 점수

    premium = ((contract_price - avg_trade_price) / avg_trade_price) * 100

    if premium < -10:
        score = 0
    elif premium < 0:
        score = 10
    elif premium < 10:
        score = 20
    elif premium < 20:
        score = 30
    else:
        score = 40

    return premium, score


def evaluate_property_value_with_llm(
    property_address: str
) -> PropertyValueAssessment:
    """
    부동산 가치 평가 (매매 전용, LLM 웹 검색 기반)

    평가 항목 (총 40점, 낮을수록 좋음):
    1. 학군 정보 (0~15점)
    2. 5개년 입주 물량 - 공급 과잉 (0~15점)
    3. 직장 수요 (0~10점)

    LLM: OpenAI GPT-4 + 웹 검색
    """
    import os
    from openai import OpenAI
    import json

    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    # LLM 프롬프트
    prompt = f"""
당신은 부동산 전문가입니다. 다음 주소의 부동산 가치를 **웹 검색을 통해** 평가하세요.

**주소**: {property_address}

다음 3가지 항목을 평가하고, 각각의 점수와 이유를 제공하세요. 점수는 **낮을수록 좋음**입니다.

### 1. 학군 정보 (0~15점)
- 초/중/고등학교 수준, 특목고/자사고 유무, 학원가 발달도 등을 평가
- 점수 기준:
  - 0~5점: 우수 학군 (특목고/자사고 있음, 학원가 발달)
  - 6~10점: 중상위 학군 (일반고 우수, 학원가 보통)
  - 11~15점: 일반 학군 (평범한 수준)

### 2. 공급 과잉 평가 (0~15점)
- 향후 3~5년간 입주 예정 물량, 미분양 현황, 재개발/재건축 계획 등을 평가
- 점수 기준:
  - 0~5점: 공급 부족 (입주 물량 적음, 수요 > 공급)
  - 6~10점: 적정 공급 (수요와 공급 균형)
  - 11~15점: 공급 과잉 (대규모 입주 예정, 수요 < 공급)

### 3. 직장 수요 (0~10점)
- 주변 업무지구/산업단지 접근성, 교통 편의성, 자체 일자리 등을 평가
- 점수 기준:
  - 0~3점: 우수 (CBD 인접, 대기업/공공기관 밀집)
  - 4~7점: 보통 (대중교통 접근성 양호)
  - 8~10점: 부족 (교통 불편, 일자리 부족)

**응답 형식 (JSON만 반환):**
{{
  "school_score": <숫자 0~15>,
  "school_reason": "<평가 이유 1~2문장>",
  "supply_score": <숫자 0~15>,
  "supply_reason": "<평가 이유 1~2문장>",
  "job_score": <숫자 0~10>,
  "job_reason": "<평가 이유 1~2문장>",
  "summary": "<종합 평가 2~3문장>"
}}

**주의사항**:
- 반드시 웹 검색을 통해 최신 정보를 확인하세요.
- 점수는 **낮을수록 좋음**입니다.
- JSON 형식만 반환하고, 다른 텍스트는 포함하지 마세요.
"""

    try:
        # OpenAI API 호출 (웹 검색 가능한 모델 사용)
        response = client.chat.completions.create(
            model="gpt-4o",  # 웹 검색 가능 모델
            messages=[
                {
                    "role": "system",
                    "content": "당신은 부동산 전문가입니다. 웹 검색을 통해 최신 정보를 확인하고 정확한 분석을 제공하세요."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,
            max_tokens=1000,
        )

        # 응답 파싱
        result_text = response.choices[0].message.content.strip()

        # JSON 파싱 (코드 블록 제거)
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()

        result = json.loads(result_text)

        # PropertyValueAssessment 객체 생성
        assessment = PropertyValueAssessment(
            school_score=result.get("school_score", 8),
            school_reason=result.get("school_reason", "평가 정보 부족"),
            supply_score=result.get("supply_score", 8),
            supply_reason=result.get("supply_reason", "평가 정보 부족"),
            job_score=result.get("job_score", 5),
            job_reason=result.get("job_reason", "평가 정보 부족"),
            total_score=result.get("school_score", 8) + result.get("supply_score", 8) + result.get("job_score", 5),
            summary=result.get("summary", "부동산 가치 평가 완료")
        )

        return assessment

    except Exception as e:
        # 오류 발생 시 중립 점수 반환
        print(f"LLM 웹 검색 오류: {e}")
        return PropertyValueAssessment(
            school_score=8,
            school_reason=f"평가 실패: {str(e)[:100]}",
            supply_score=8,
            supply_reason="웹 검색 오류로 평가 불가",
            job_score=5,
            job_reason="웹 검색 오류로 평가 불가",
            total_score=21,
            summary="부동산 가치 평가 중 오류가 발생했습니다. 중립 점수로 반환합니다."
        )


def calculate_sale_legal_risk(registry: RegistryData) -> tuple[int, List[str]]:
    """
    법적 리스크 및 하자 분석 (매매 전용)

    점수 (0~20점, 낮을수록 좋음):
    - 압류: 10점
    - 가압류: 5점
    - 소유권 분쟁: 10점
    - 전세권 존재: 5점 (명도 이슈)
    - 근저당 과다: 5점 (근저당 비율 >60%)
    """
    score = 0
    factors = []

    if registry.seizure_exists:
        score += 10
        factors.append("압류 존재 (명도 어려움)")

    if registry.provisional_attachment_exists:
        score += 5
        factors.append("가압류 존재")

    if registry.ownership_disputes:
        score += 10
        factors.append("소유권 분쟁")

    if registry.lease_rights_exists:
        score += 5
        factors.append("전세권 설정 (명도 필요)")

    # 근저당 과다 체크
    if registry.mortgage_total and registry.property_value:
        mortgage_ratio = calculate_mortgage_ratio(
            registry.mortgage_total,
            registry.property_value
        )
        if mortgage_ratio > 60:
            score += 5
            factors.append(f"근저당 과다 ({mortgage_ratio:.1f}%)")

    return min(score, 20), factors  # 최대 20점


def calculate_sale_risk_score(
    contract: ContractData,
    registry: Optional[RegistryData],
    market: Optional[MarketData],
    property_value: Optional[PropertyValueAssessment]
) -> RiskScore:
    """
    매매 리스크 점수 계산

    점수 구성 (0~100점, 낮을수록 좋음):
    1. 가격 적정성 (0~40점) - 필수
    2. 부동산 가치 평가 (0~40점) - 선택 (없으면 중립 20점)
    3. 법적 리스크 (0~20점) - 선택 (없으면 0점)
    """
    total_score = 0.0
    risk_factors = []

    # 1. 가격 적정성 (40점)
    price_premium = 0.0
    price_score = 20  # 기본값

    if market and market.avg_trade_price:
        price_premium, price_score = calculate_price_premium(
            contract.price or 0,
            market.avg_trade_price
        )
        total_score += price_score

        if price_premium > 20:
            risk_factors.append(f"시세 대비 {price_premium:.1f}% 고가 (심각)")
        elif price_premium > 10:
            risk_factors.append(f"시세 대비 {price_premium:.1f}% 고가 (위험)")
        elif price_premium > 0:
            risk_factors.append(f"시세 대비 {price_premium:.1f}% 고가 (주의)")
    else:
        total_score += 20  # 데이터 없으면 중립
        risk_factors.append("실거래가 데이터 없음 (검증 필요)")

    # 2. 부동산 가치 평가 (40점)
    if property_value:
        total_score += property_value.total_score
        if property_value.school_score > 10:
            risk_factors.append(f"학군 약세 ({property_value.school_reason})")
        if property_value.supply_score > 10:
            risk_factors.append(f"공급 과잉 ({property_value.supply_reason})")
        if property_value.job_score > 7:
            risk_factors.append(f"직장 수요 약세 ({property_value.job_reason})")
    else:
        total_score += 20  # 데이터 없으면 중립

    # 3. 법적 리스크 (20점)
    if registry:
        legal_score, legal_factors = calculate_sale_legal_risk(registry)
        total_score += legal_score
        risk_factors.extend(legal_factors)

    # 리스크 레벨 판정
    if total_score >= 71:
        risk_level = "심각"
    elif total_score >= 51:
        risk_level = "위험"
    elif total_score >= 31:
        risk_level = "주의"
    else:
        risk_level = "안전"

    # RiskScore에 property_value 세부 정보 포함 (리포트 생성용)
    risk_score_dict = {
        "total_score": total_score,
        "jeonse_ratio": None,  # 매매는 전세가율 없음
        "mortgage_ratio": None,
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "price_fairness_score": price_score,
        "property_value_score": property_value.total_score if property_value else 20,
        "legal_risk_score": legal_score if registry else 0,
    }

    # 부동산 가치 평가 세부 정보 추가
    if property_value:
        risk_score_dict.update({
            "school_score": property_value.school_score,
            "school_reason": property_value.school_reason,
            "supply_score": property_value.supply_score,
            "supply_reason": property_value.supply_reason,
            "job_score": property_value.job_score,
            "job_reason": property_value.job_reason,
            "property_value_summary": property_value.summary,
        })

    return RiskScore(**risk_score_dict)


# ===========================
# 임대차 리스크 엔진 함수
# ===========================
def calculate_risk_score(
    contract: ContractData,
    registry: RegistryData
) -> RiskScore:
    """
    리스크 점수 계산

    점수 = 전세가율 점수 + 근저당 점수 + 권리하자 점수
    - 0~30: 안전
    - 31~50: 주의
    - 51~70: 위험
    - 71~100: 심각
    """
    total_score = 0.0
    risk_factors = []
    jeonse_ratio = None
    mortgage_ratio = None

    # 1. 전세가율 점수 (최대 40점)
    if contract.contract_type == "전세" and contract.deposit and registry.property_value:
        jeonse_ratio = calculate_jeonse_ratio(contract.deposit, registry.property_value)

        if jeonse_ratio >= 90:
            total_score += 40
            risk_factors.append(f"전세가율 {jeonse_ratio:.1f}% (심각)")
        elif jeonse_ratio >= 80:
            total_score += 30
            risk_factors.append(f"전세가율 {jeonse_ratio:.1f}% (위험)")
        elif jeonse_ratio >= 70:
            total_score += 20
            risk_factors.append(f"전세가율 {jeonse_ratio:.1f}% (주의)")
        else:
            total_score += 10
            # 안전 범위: 리스크 요인에 추가하지 않음

    # 2. 근저당 비율 점수 (최대 30점)
    if registry.mortgage_total and registry.property_value:
        mortgage_ratio = calculate_mortgage_ratio(
            registry.mortgage_total,
            registry.property_value
        )

        if mortgage_ratio >= 80:
            total_score += 30
            risk_factors.append(f"근저당 비율 {mortgage_ratio:.1f}% (심각)")
        elif mortgage_ratio >= 60:
            total_score += 20
            risk_factors.append(f"근저당 비율 {mortgage_ratio:.1f}% (위험)")
        elif mortgage_ratio >= 40:
            total_score += 10
            risk_factors.append(f"근저당 비율 {mortgage_ratio:.1f}% (주의)")

    # 3. 권리하자 점수 (각 10점, 최대 30점)
    if registry.seizure_exists:
        total_score += 10
        risk_factors.append("압류 존재")

    if registry.provisional_attachment_exists:
        total_score += 10
        risk_factors.append("가압류 존재")

    if registry.ownership_disputes:
        total_score += 10
        risk_factors.append("소유권 분쟁 존재")

    # 리스크 레벨 판정
    if total_score >= 71:
        risk_level = "심각"
    elif total_score >= 51:
        risk_level = "위험"
    elif total_score >= 31:
        risk_level = "주의"
    else:
        risk_level = "안전"

    return RiskScore(
        total_score=total_score,
        jeonse_ratio=jeonse_ratio,
        mortgage_ratio=mortgage_ratio,
        risk_level=risk_level,
        risk_factors=risk_factors,
    )


def extract_rental_negotiation_points(
    contract: ContractData,
    registry: RegistryData,
    risk_score: RiskScore
) -> List[NegotiationPoint]:
    """
    임대차 협상 포인트 추출

    리스크 점수와 데이터 분석 결과를 바탕으로 협상 포인트 생성
    """
    points = []

    # 1. 전세가율 기반 협상 포인트
    if risk_score.jeonse_ratio and risk_score.jeonse_ratio >= 80:
        points.append(NegotiationPoint(
            category="가격",
            point=f"전세가율이 {risk_score.jeonse_ratio:.1f}%로 높습니다. 보증금 인하를 요청하세요.",
            impact="높음"
        ))

    # 2. 근저당 기반 협상 포인트
    if risk_score.mortgage_ratio and risk_score.mortgage_ratio >= 60:
        points.append(NegotiationPoint(
            category="특약",
            point=f"근저당 비율이 {risk_score.mortgage_ratio:.1f}%입니다. 우선변제권 확보를 특약에 명시하세요.",
            impact="높음"
        ))

    # 3. 권리하자 기반 협상 포인트
    if registry.seizure_exists:
        points.append(NegotiationPoint(
            category="권리관계",
            point="압류가 존재합니다. 계약 전 압류 해제를 요구하세요.",
            impact="높음"
        ))

    if registry.provisional_attachment_exists:
        points.append(NegotiationPoint(
            category="권리관계",
            point="가압류가 존재합니다. 가압류 해제 후 계약을 진행하세요.",
            impact="중간"
        ))

    if registry.ownership_disputes:
        points.append(NegotiationPoint(
            category="권리관계",
            point="소유권 분쟁이 있습니다. 분쟁 해결 후 계약을 검토하세요.",
            impact="높음"
        ))

    # 4. 특약사항 기반 협상 포인트
    if contract.special_terms:
        points.append(NegotiationPoint(
            category="특약",
            point="특약사항이 있습니다. 법무사 검토를 받으세요.",
            impact="중간"
        ))

    return points


def extract_sale_negotiation_points(
    contract: ContractData,
    registry: Optional[RegistryData],
    market: Optional[MarketData],
    risk_score: RiskScore
) -> List[NegotiationPoint]:
    """
    매매 협상 포인트 추출

    리스크 점수와 데이터 분석 결과를 바탕으로 협상 포인트 생성
    """
    points = []

    # 1. 가격 협상 포인트
    if market and market.avg_trade_price and contract.price:
        premium = ((contract.price - market.avg_trade_price) / market.avg_trade_price) * 100

        if premium > 10:
            points.append(NegotiationPoint(
                category="가격",
                point=f"시세 대비 {premium:.1f}% 높습니다. 가격 인하를 요청하세요.",
                impact="높음" if premium > 20 else "중간"
            ))
        elif premium > 0:
            points.append(NegotiationPoint(
                category="가격",
                point=f"시세 대비 {premium:.1f}% 높습니다. 가격 조정을 검토하세요.",
                impact="중간"
            ))

    # 2. 권리관계 협상 포인트 (등기부 있는 경우)
    if registry:
        if registry.seizure_exists:
            points.append(NegotiationPoint(
                category="권리관계",
                point="압류가 존재합니다. 계약 전 압류 해제 및 명도 확인이 필수입니다.",
                impact="높음"
            ))

        if registry.provisional_attachment_exists:
            points.append(NegotiationPoint(
                category="권리관계",
                point="가압류가 존재합니다. 해제 후 계약을 진행하세요.",
                impact="중간"
            ))

        if registry.ownership_disputes:
            points.append(NegotiationPoint(
                category="권리관계",
                point="소유권 분쟁이 있습니다. 계약 진행을 재검토하세요.",
                impact="높음"
            ))

        if registry.lease_rights_exists:
            points.append(NegotiationPoint(
                category="권리관계",
                point="전세권이 설정되어 있습니다. 명도 일정 및 비용을 협의하세요.",
                impact="높음"
            ))

        # 근저당 과다
        if registry.mortgage_total and registry.property_value:
            mortgage_ratio = calculate_mortgage_ratio(
                registry.mortgage_total,
                registry.property_value
            )
            if mortgage_ratio > 60:
                points.append(NegotiationPoint(
                    category="특약",
                    point=f"근저당 비율이 {mortgage_ratio:.1f}%로 높습니다. 잔금 전 말소 확약을 특약에 명시하세요.",
                    impact="높음"
                ))

    # 3. 특약사항
    if contract.special_terms:
        points.append(NegotiationPoint(
            category="특약",
            point="특약사항이 있습니다. 법무사 검토를 받으세요.",
            impact="중간"
        ))

    return points


def generate_rental_recommendations(
    contract: ContractData,
    registry: RegistryData,
    risk_score: RiskScore
) -> List[str]:
    """
    임대차 권장 조치 생성

    리스크 레벨에 따른 조치 권장사항
    """
    recommendations = []

    if risk_score.risk_level == "심각":
        recommendations.append("⚠️ 계약 진행을 재검토하세요. 법무사 또는 변호사 상담을 강력히 권장합니다.")
        recommendations.append("전세보증금반환보증 가입을 필수로 고려하세요.")
    elif risk_score.risk_level == "위험":
        recommendations.append("⚠️ 계약 전 법무사 상담을 권장합니다.")
        recommendations.append("전세보증금반환보증 가입을 적극 검토하세요.")
    elif risk_score.risk_level == "주의":
        recommendations.append("계약 전 등기부등본을 재확인하세요.")
        recommendations.append("전세보증금반환보증 가입을 검토하세요.")
    else:
        recommendations.append("✅ 비교적 안전한 계약으로 보입니다.")
        recommendations.append("최종 계약 전 법무사 검토를 받으면 더욱 안심할 수 있습니다.")

    # 권리하자 관련 권장사항
    if registry.seizure_exists or registry.provisional_attachment_exists:
        recommendations.append("압류/가압류 해제 여부를 반드시 확인하세요.")

    return recommendations


def generate_sale_recommendations(
    contract: ContractData,
    registry: Optional[RegistryData],
    market: Optional[MarketData],
    risk_score: RiskScore
) -> List[str]:
    """
    매매 권장 조치 생성

    리스크 레벨에 따른 조치 권장사항
    """
    recommendations = []

    if risk_score.risk_level == "심각":
        recommendations.append("⚠️ 계약 진행을 재검토하세요. 법무사 또는 변호사 상담을 강력히 권장합니다.")
        recommendations.append("가격 협상 또는 다른 매물 검토를 권장합니다.")
    elif risk_score.risk_level == "위험":
        recommendations.append("⚠️ 계약 전 법무사 상담을 권장합니다.")
        recommendations.append("가격 조정 협상을 적극 검토하세요.")
    elif risk_score.risk_level == "주의":
        recommendations.append("계약 전 법무사 검토를 받으세요.")
        recommendations.append("주변 시세를 재확인하세요.")
    else:
        recommendations.append("✅ 비교적 적정한 거래로 보입니다.")
        recommendations.append("최종 계약 전 법무사 검토를 받으면 더욱 안심할 수 있습니다.")

    # 등기부 확인 권장
    if not registry:
        recommendations.append("📋 등기부등본을 발급받아 권리관계를 확인하세요.")
    else:
        # 권리하자 관련 권장사항
        if registry.seizure_exists or registry.provisional_attachment_exists:
            recommendations.append("압류/가압류 해제 및 명도 일정을 반드시 확인하세요.")

        if registry.lease_rights_exists:
            recommendations.append("전세권자와의 명도 협의 및 비용을 확인하세요.")

    # 시세 데이터 확인 권장
    if not market:
        recommendations.append("📊 주변 실거래가를 확인하세요.")

    return recommendations


def analyze_risks(
    contract: ContractData,
    registry: Optional[RegistryData] = None,
    market: Optional[MarketData] = None,
    property_value: Optional[PropertyValueAssessment] = None
) -> RiskAnalysisResult:
    """
    리스크 종합 분석 (통합 파이프라인)

    메인 함수: 계약 타입에 따라 적절한 분석 엔진 실행

    Args:
        contract: 계약서 데이터 (필수)
        registry: 등기부 데이터 (매매는 선택, 임대차는 필수)
        market: 시장 데이터 (매매 전용, 선택)
        property_value: 부동산 가치 평가 (매매 전용, 선택)

    Returns:
        RiskAnalysisResult: 리스크 분석 결과
    """
    # 계약 타입에 따라 분기
    if contract.contract_type == "매매":
        # 매매 리스크 엔진
        risk_score = calculate_sale_risk_score(contract, registry, market, property_value)
        negotiation_points = extract_sale_negotiation_points(
            contract, registry, market, risk_score
        )
        recommendations = generate_sale_recommendations(
            contract, registry, market, risk_score
        )

    else:
        # 임대차 리스크 엔진 (전세/월세)
        if not registry:
            raise ValueError("임대차 계약은 등기부 데이터가 필수입니다.")

        risk_score = calculate_risk_score(contract, registry)
        negotiation_points = extract_rental_negotiation_points(
            contract, registry, risk_score
        )
        recommendations = generate_rental_recommendations(
            contract, registry, risk_score
        )

    return RiskAnalysisResult(
        risk_score=risk_score,
        negotiation_points=negotiation_points,
        recommendations=recommendations,
    )


# ===========================
# 예시 사용법 (테스트용)
# ===========================
if __name__ == "__main__":
    print("=" * 60)
    print("예시 1: 전세 계약 분석")
    print("=" * 60)

    # 전세 계약 데이터
    rental_contract = ContractData(
        contract_type="전세",
        deposit=50000,  # 5억
        price=None,
        monthly_rent=None,
    )

    rental_registry = RegistryData(
        property_value=60000,  # 6억
        mortgage_total=10000,  # 1억
        seizure_exists=False,
        provisional_attachment_exists=False,
        ownership_disputes=False,
    )

    # 분석 실행
    rental_result = analyze_risks(rental_contract, rental_registry)

    print(f"총 점수: {rental_result.risk_score.total_score:.1f}")
    print(f"리스크 레벨: {rental_result.risk_score.risk_level}")
    print(f"전세가율: {rental_result.risk_score.jeonse_ratio:.1f}%")
    print(f"근저당 비율: {rental_result.risk_score.mortgage_ratio:.1f}%")
    print(f"\n위험 요인: {', '.join(rental_result.risk_score.risk_factors)}")
    print(f"\n협상 포인트: {len(rental_result.negotiation_points)}개")
    for point in rental_result.negotiation_points:
        print(f"  - [{point.category}] {point.point} (영향: {point.impact})")
    print(f"\n권장 조치:")
    for rec in rental_result.recommendations:
        print(f"  - {rec}")

    print("\n" + "=" * 60)
    print("예시 2: 매매 계약 분석 (등기부 없음)")
    print("=" * 60)

    # 매매 계약 데이터
    sale_contract = ContractData(
        contract_type="매매",
        price=80000,  # 8억
        property_address="서울특별시 강남구 역삼동 123-45",
    )

    # 시장 데이터
    sale_market = MarketData(
        avg_trade_price=75000,  # 평균 7.5억
        recent_trades=[],
        avg_price_per_pyeong=2500,  # 평당 2,500만원
    )

    # 부동산 가치 평가 (LLM 웹 검색 결과라고 가정)
    sale_property_value = PropertyValueAssessment(
        school_score=8,  # 학군 보통
        school_reason="중위권 학군, 특목고 없음",
        supply_score=12,  # 공급 다소 많음
        supply_reason="향후 3년간 5000세대 입주 예정",
        job_score=6,  # 직장 수요 보통
        job_reason="강남권 접근성 양호, 자체 일자리 보통",
        total_score=26,  # 총 26점 (주의 범위)
        summary="학군은 중위권, 공급 과잉 우려, 직장 수요는 보통"
    )

    # 분석 실행 (등기부 없음)
    sale_result = analyze_risks(
        sale_contract,
        registry=None,
        market=sale_market,
        property_value=sale_property_value
    )

    print(f"총 점수: {sale_result.risk_score.total_score:.1f}")
    print(f"리스크 레벨: {sale_result.risk_score.risk_level}")
    print(f"\n위험 요인: {', '.join(sale_result.risk_score.risk_factors)}")
    print(f"\n협상 포인트: {len(sale_result.negotiation_points)}개")
    for point in sale_result.negotiation_points:
        print(f"  - [{point.category}] {point.point} (영향: {point.impact})")
    print(f"\n권장 조치:")
    for rec in sale_result.recommendations:
        print(f"  - {rec}")

    print("\n" + "=" * 60)
    print("예시 3: 매매 계약 분석 (등기부 포함)")
    print("=" * 60)

    # 등기부 데이터 추가
    sale_registry = RegistryData(
        property_value=85000,  # 8.5억 (공시지가 기준)
        mortgage_total=55000,  # 5.5억 (근저당)
        seizure_exists=False,
        provisional_attachment_exists=False,
        ownership_disputes=False,
        lease_rights_exists=True,  # 전세권 존재 (명도 필요)
    )

    # 분석 실행 (등기부 포함)
    sale_with_registry_result = analyze_risks(
        sale_contract,
        registry=sale_registry,
        market=sale_market,
        property_value=sale_property_value
    )

    print(f"총 점수: {sale_with_registry_result.risk_score.total_score:.1f}")
    print(f"리스크 레벨: {sale_with_registry_result.risk_score.risk_level}")
    print(f"\n위험 요인: {', '.join(sale_with_registry_result.risk_score.risk_factors)}")
    print(f"\n협상 포인트: {len(sale_with_registry_result.negotiation_points)}개")
    for point in sale_with_registry_result.negotiation_points:
        print(f"  - [{point.category}] {point.point} (영향: {point.impact})")
    print(f"\n권장 조치:")
    for rec in sale_with_registry_result.recommendations:
        print(f"  - {rec}")

"""
ZipCheck AI Guardrails - 부동산 전용 질문 필터링 시스템

부동산/계약서 관련 질문만 허용하고, 무관한 질문은 거부합니다.
"""

from typing import Optional, Dict, Any
from enum import Enum
import re


class QuestionCategory(Enum):
    """질문 카테고리"""
    REAL_ESTATE = "부동산 관련"
    CONTRACT = "계약서 관련"
    LEGAL = "부동산 법률 관련"
    OFF_TOPIC = "무관한 질문"


class GuardrailResponse:
    """가드레일 응답 객체"""
    def __init__(
        self,
        is_allowed: bool,
        category: QuestionCategory,
        confidence: float,
        reason: Optional[str] = None
    ):
        self.is_allowed = is_allowed
        self.category = category
        self.confidence = confidence
        self.reason = reason


# 부동산 관련 키워드 (한국어)
REAL_ESTATE_KEYWORDS = {
    # 계약 관련
    "계약서", "매매계약", "임대차계약", "전세계약", "월세계약", "분양계약",
    "특약", "중개", "중개수수료", "계약금", "중도금", "잔금",

    # 부동산 유형
    "아파트", "빌라", "오피스텔", "다가구", "단독주택", "상가", "토지",
    "재건축", "재개발", "분양", "입주", "준공",

    # 권리/등기
    "등기부", "소유권", "근저당", "전세권", "임차권", "가압류", "가등기",
    "말소", "설정", "이전", "말소기준권리",

    # 법률/제도
    "부동산실거래가", "취득세", "양도세", "재산세", "종부세",
    "주택임대차보호법", "상가건물임대차보호법", "확정일자", "대항력",
    "우선변제권", "임대차", "보증금", "전세금", "임차보증금",

    # 문제/리스크
    "하자", "누수", "균열", "하자담보책임", "계약해제", "위약금",
    "사기", "이중계약", "미등기", "불법건축물", "용도변경",

    # 절차/서류
    "잔금일", "소유권이전", "등기이전", "명도", "이사", "입주",
    "부동산중개", "공인중개사", "법무사", "등기소", "주민센터"
}

# 금지 키워드 (무조건 차단)
FORBIDDEN_KEYWORDS = {
    # 코딩/프로그래밍
    "코드", "프로그래밍", "파이썬", "python", "javascript", "java", "c++",
    "함수", "변수", "클래스", "알고리즘", "디버깅", "코딩",

    # 일반 잡담
    "날씨", "맛집", "영화", "음악", "게임", "연예인", "스포츠",
    "요리", "레시피", "여행", "관광", "축구", "야구", "농구",

    # 학습/과제
    "숙제", "과제", "리포트", "보고서", "논문", "에세이",

    # 기타
    "번역", "통역", "작사", "작곡", "시", "소설", "이야기"
}

# 거부 응답 템플릿
REJECTION_TEMPLATES = {
    QuestionCategory.OFF_TOPIC: """고객님, 안녕하십니까.

본 시스템은 **부동산 계약서 리스크 분석 전문 서비스**로서, 다음과 같은 부동산 관련 문의에 한하여 전문적인 분석을 제공하고 있습니다:

**전문 분석 가능 영역**
• 부동산 매매·임대차 계약서 검토 및 리스크 분석
• 아파트, 빌라, 오피스텔, 상가 등 부동산 거래 관련 상담
• 등기부등본 해석 및 권리관계 분석
• 부동산 관련 법률 (주택임대차보호법, 상가건물임대차보호법 등)
• 전세금·보증금 반환, 중개수수료, 세금(취득세, 양도세 등) 관련 문의
• 계약 조건, 특약 사항 검토

부동산 계약 및 거래와 관련된 전문적인 문의를 주시면, 정확하고 신뢰할 수 있는 분석 결과를 제공해드리겠습니다.

감사합니다."""
}


class RealEstateGuardrail:
    """부동산 전용 가드레일 클래스"""

    def __init__(self, strict_mode: bool = True):
        """
        Args:
            strict_mode: True면 엄격한 필터링, False면 관대한 필터링
        """
        self.strict_mode = strict_mode
        self.min_confidence_threshold = 0.7 if strict_mode else 0.5

    def check_question(self, question: str) -> GuardrailResponse:
        """
        질문이 부동산 관련인지 검사

        Args:
            question: 사용자 질문

        Returns:
            GuardrailResponse: 허용 여부와 카테고리
        """
        # 0. 금지 키워드 체크 (최우선)
        if self._has_forbidden_keywords(question):
            return GuardrailResponse(
                is_allowed=False,
                category=QuestionCategory.OFF_TOPIC,
                confidence=0.0,
                reason=self._get_rejection_reason(QuestionCategory.OFF_TOPIC)
            )

        # 1. 키워드 매칭으로 1차 필터링
        keyword_score = self._calculate_keyword_score(question)

        # 2. 패턴 매칭으로 2차 필터링
        pattern_score = self._calculate_pattern_score(question)

        # 3. 최종 점수 계산 (가중 평균)
        final_score = (keyword_score * 0.7) + (pattern_score * 0.3)

        # 4. 카테고리 판단
        category = self._determine_category(question, final_score)

        # 5. 허용 여부 결정
        is_allowed = final_score >= self.min_confidence_threshold

        # 6. 거부 사유
        reason = None if is_allowed else self._get_rejection_reason(category)

        return GuardrailResponse(
            is_allowed=is_allowed,
            category=category,
            confidence=final_score,
            reason=reason
        )

    def _has_forbidden_keywords(self, question: str) -> bool:
        """금지 키워드 포함 여부 확인"""
        question_lower = question.lower()
        return any(
            keyword in question_lower
            for keyword in FORBIDDEN_KEYWORDS
        )

    def _calculate_keyword_score(self, question: str) -> float:
        """키워드 매칭 점수 계산"""
        question_lower = question.lower()

        # 부동산 키워드 매칭 개수
        matched_keywords = sum(
            1 for keyword in REAL_ESTATE_KEYWORDS
            if keyword in question_lower
        )

        # 점수 정규화 (최대 3개 키워드면 1.0점)
        score = min(matched_keywords / 3.0, 1.0)

        return score

    def _calculate_pattern_score(self, question: str) -> float:
        """패턴 매칭 점수 계산"""
        score = 0.0

        # 부동산 관련 패턴들
        patterns = [
            # 계약 관련 질문 패턴
            r"계약.*(?:어떻|괜찮|위험|문제|확인)",
            r"(?:전세|월세|매매).*(?:계약|금|보증)",

            # 등기/법률 관련
            r"등기.*(?:확인|문제|내용)",
            r"(?:취득세|양도세|재산세)",

            # 리스크 관련
            r"(?:사기|위험|문제|하자|리스크)",

            # 절차 관련
            r"(?:이사|입주|명도|잔금).*(?:절차|방법|어떻게)"
        ]

        for pattern in patterns:
            if re.search(pattern, question):
                score += 0.2

        return min(score, 1.0)

    def _determine_category(
        self,
        question: str,
        score: float
    ) -> QuestionCategory:
        """질문 카테고리 결정"""
        if score < self.min_confidence_threshold:
            return QuestionCategory.OFF_TOPIC

        # 계약서 관련 키워드
        if any(kw in question for kw in ["계약서", "계약", "특약"]):
            return QuestionCategory.CONTRACT

        # 법률 관련 키워드
        if any(kw in question for kw in ["법", "소송", "권리", "의무"]):
            return QuestionCategory.LEGAL

        # 기본: 부동산 관련
        return QuestionCategory.REAL_ESTATE

    def _get_rejection_reason(self, category: QuestionCategory) -> str:
        """거부 사유 메시지 생성"""
        return REJECTION_TEMPLATES.get(
            category,
            REJECTION_TEMPLATES[QuestionCategory.OFF_TOPIC]
        )

    def format_rejection_message(self, response: GuardrailResponse) -> str:
        """거부 메시지 포맷팅"""
        if response.is_allowed:
            return ""

        return response.reason or REJECTION_TEMPLATES[QuestionCategory.OFF_TOPIC]


# 싱글톤 인스턴스
_guardrail_instance = None


def get_guardrail(strict_mode: bool = True) -> RealEstateGuardrail:
    """가드레일 싱글톤 인스턴스 가져오기"""
    global _guardrail_instance
    if _guardrail_instance is None:
        _guardrail_instance = RealEstateGuardrail(strict_mode=strict_mode)
    return _guardrail_instance


# 편의 함수
def check_question(question: str, strict: bool = True) -> Dict[str, Any]:
    """
    질문 검사 (간단한 인터페이스)

    Returns:
        {
            "allowed": bool,
            "category": str,
            "confidence": float,
            "message": str (거부 시에만)
        }
    """
    guardrail = get_guardrail(strict_mode=strict)
    response = guardrail.check_question(question)

    result = {
        "allowed": response.is_allowed,
        "category": response.category.value,
        "confidence": round(response.confidence, 2)
    }

    if not response.is_allowed:
        result["message"] = guardrail.format_rejection_message(response)

    return result

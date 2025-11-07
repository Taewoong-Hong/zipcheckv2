"""
마크다운 형식 리포트 생성기

노션 스타일의 마크다운 리포트 생성
"""
from typing import Dict, Any, Optional
from datetime import datetime


def generate_markdown_report(
    contract_type: str,
    address: str,
    deposit: Optional[int],
    monthly_rent: Optional[int],
    risk_score: Dict[str, Any],
    negotiation_points: list,
    recommendations: list,
    registry_data: Optional[Dict[str, Any]] = None,
    market_data: Optional[Dict[str, Any]] = None,
) -> str:
    """
    마크다운 형식 리포트 생성

    Args:
        contract_type: 계약 유형 (전세/월세/전월세/매매)
        address: 부동산 주소
        deposit: 보증금 또는 매매가 (만원)
        monthly_rent: 월세 (만원, 월세/전월세만)
        risk_score: 리스크 점수 데이터
        negotiation_points: 협상 포인트 목록
        recommendations: 권장 조치 목록
        registry_data: 등기부 데이터 (선택)
        market_data: 시장 데이터 (매매만, 선택)

    Returns:
        마크다운 형식 리포트 문자열
    """
    lines = []

    # 헤더
    lines.append("# 🏠 부동산 계약 분석 리포트\n")
    lines.append(f"> 생성일: {datetime.now().strftime('%Y년 %m월 %d일 %H:%M')}\n")
    lines.append("---\n")

    # 기본 정보
    lines.append("## 📊 기본 정보\n")
    lines.append(f"- **계약 유형**: {contract_type}")
    lines.append(f"- **주소**: {address}")

    if contract_type == "매매":
        if deposit is not None:
            lines.append(f"- **매매가**: {deposit:,}만원 ({deposit * 10000:,}원)")
        else:
            lines.append(f"- **매매가**: 정보 없음")
    else:
        if deposit is not None:
            lines.append(f"- **보증금**: {deposit:,}만원 ({deposit * 10000:,}원)")
        else:
            lines.append(f"- **보증금**: 정보 없음")
        if monthly_rent:
            lines.append(f"- **월세**: {monthly_rent:,}만원")

    lines.append("")

    # 리스크 분석
    lines.append("## ⚠️ 리스크 분석\n")

    total_score = risk_score.get("total_score", 0)
    risk_level = risk_score.get("risk_level", "알 수 없음")
    risk_factors = risk_score.get("risk_factors", [])

    # 리스크 레벨에 따른 이모지
    risk_emoji = {
        "안전": "✅",
        "주의": "⚠️",
        "위험": "🔴",
        "심각": "🚨"
    }
    emoji = risk_emoji.get(risk_level, "❓")

    lines.append(f"### {emoji} 종합 리스크 레벨: **{risk_level}**\n")
    lines.append(f"- **총점**: {total_score}점 / 100점")
    lines.append("")

    # 계약 유형별 세부 점수
    if contract_type == "매매":
        _add_sale_risk_details(lines, risk_score, market_data)
    else:
        _add_rental_risk_details(lines, risk_score, registry_data)

    # 위험 요인
    if risk_factors:
        lines.append("### 🔍 주요 위험 요인\n")
        for factor in risk_factors:
            lines.append(f"- {factor}")
        lines.append("")

    # 협상 포인트
    if negotiation_points:
        lines.append("## 💡 협상 포인트\n")
        for idx, point in enumerate(negotiation_points, 1):
            category = point.get("category", "기타")
            content = point.get("point", "")
            impact = point.get("impact", "중간")

            impact_emoji = {"높음": "🔴", "중간": "🟡", "낮음": "🟢"}.get(impact, "⚪")
            lines.append(f"### {idx}. {category} {impact_emoji}\n")
            lines.append(f"**내용**: {content}\n")
            if point.get("suggestion"):
                lines.append(f"**제안**: {point.get('suggestion')}\n")
            lines.append("")

    # 권장 조치
    if recommendations:
        lines.append("## ✅ 권장 조치 사항\n")
        for idx, rec in enumerate(recommendations, 1):
            lines.append(f"{idx}. {rec}")
        lines.append("")

    # 등기부 정보 (있을 경우)
    if registry_data:
        _add_registry_info(lines, registry_data)

    # 푸터
    lines.append("---\n")
    lines.append("## ⚖️ 법률 고지\n")
    lines.append("> ⚠️ **중요**: 이 리포트는 AI 기반 자동 분석 결과로, 참고 목적으로만 사용하시기 바랍니다.\n")
    lines.append("> 최종 계약 전 **반드시 법무사 또는 변호사와 상담**하시기 바랍니다.\n")
    lines.append("")
    lines.append("**제공**: 집체크 AI | **문의**: support@zipcheck.kr")

    return "\n".join(lines)


def _add_rental_risk_details(lines: list, risk_score: Dict[str, Any], registry_data: Optional[Dict[str, Any]]):
    """임대차 계약 리스크 세부 정보"""
    lines.append("### 📈 세부 점수\n")

    # 전세가율
    jeonse_ratio = risk_score.get("jeonse_ratio")
    jeonse_score = risk_score.get("jeonse_ratio_score", 0)
    if jeonse_ratio:
        lines.append(f"#### 1. 전세가율: {jeonse_ratio:.1f}% ({jeonse_score}점 / 40점)\n")
        if jeonse_ratio >= 90:
            lines.append("🚨 **매우 높음**: 전세가율이 90% 이상으로 매우 위험한 수준입니다.")
        elif jeonse_ratio >= 80:
            lines.append("🔴 **높음**: 전세가율이 80% 이상으로 주의가 필요합니다.")
        elif jeonse_ratio >= 70:
            lines.append("⚠️ **보통**: 전세가율이 70% 이상입니다.")
        else:
            lines.append("✅ **안전**: 전세가율이 70% 미만으로 비교적 안전합니다.")
        lines.append("")

    # 근저당 비율
    mortgage_ratio = risk_score.get("mortgage_ratio")
    mortgage_score = risk_score.get("mortgage_ratio_score", 0)
    if mortgage_ratio is not None:
        lines.append(f"#### 2. 근저당 비율: {mortgage_ratio:.1f}% ({mortgage_score}점 / 30점)\n")
        if mortgage_ratio >= 80:
            lines.append("🚨 **매우 높음**: 근저당 비율이 80% 이상입니다.")
        elif mortgage_ratio >= 60:
            lines.append("🔴 **높음**: 근저당 비율이 60% 이상입니다.")
        elif mortgage_ratio >= 40:
            lines.append("⚠️ **보통**: 근저당 비율이 40% 이상입니다.")
        else:
            lines.append("✅ **낮음**: 근저당 비율이 낮습니다.")
        lines.append("")

    # 권리하자
    encumbrance_score = risk_score.get("encumbrance_score", 0)
    lines.append(f"#### 3. 권리하자: {encumbrance_score}점 / 30점\n")

    if registry_data:
        seizure = registry_data.get("seizure_exists", False)
        provisional = registry_data.get("provisional_attachment_exists", False)

        if seizure:
            lines.append("- 🚨 **압류**: 존재함 (10점)")
        if provisional:
            lines.append("- 🚨 **가압류**: 존재함 (10점)")

        if not seizure and not provisional:
            lines.append("- ✅ **압류/가압류**: 없음")

    lines.append("")


def _add_sale_risk_details(lines: list, risk_score: Dict[str, Any], market_data: Optional[Dict[str, Any]]):
    """매매 계약 리스크 세부 정보"""
    lines.append("### 📈 세부 점수\n")

    # 가격 적정성
    price_fairness_score = risk_score.get("price_fairness_score", 0)
    lines.append(f"#### 1. 가격 적정성: {price_fairness_score}점 / 40점\n")

    if market_data:
        avg_price = market_data.get("avg_trade_price")
        if avg_price:
            lines.append(f"- **시세 평균**: {avg_price:,}만원")

    if price_fairness_score >= 30:
        lines.append("🚨 **고평가**: 시세 대비 매우 높은 가격입니다.")
    elif price_fairness_score >= 20:
        lines.append("🔴 **다소 고평가**: 시세 대비 높은 편입니다.")
    elif price_fairness_score >= 10:
        lines.append("⚠️ **적정**: 시세 수준입니다.")
    else:
        lines.append("✅ **저평가**: 시세 대비 낮은 가격입니다.")
    lines.append("")

    # 부동산 가치 평가
    property_value_score = risk_score.get("property_value_score", 0)
    lines.append(f"#### 2. 부동산 가치 평가: {property_value_score}점 / 40점\n")

    # 세부 항목 표시 (risk_score에 있을 경우)
    school_score = risk_score.get("school_score")
    supply_score = risk_score.get("supply_score")
    job_score = risk_score.get("job_score")

    if school_score is not None:
        lines.append(f"- **학군**: {school_score}점 / 15점")
        school_reason = risk_score.get("school_reason", "")
        if school_reason:
            lines.append(f"  - {school_reason}")

    if supply_score is not None:
        lines.append(f"- **공급 과잉**: {supply_score}점 / 15점")
        supply_reason = risk_score.get("supply_reason", "")
        if supply_reason:
            lines.append(f"  - {supply_reason}")

    if job_score is not None:
        lines.append(f"- **직장 수요**: {job_score}점 / 10점")
        job_reason = risk_score.get("job_reason", "")
        if job_reason:
            lines.append(f"  - {job_reason}")

    property_summary = risk_score.get("property_value_summary")
    if property_summary:
        lines.append(f"\n💡 **종합 평가**: {property_summary}")

    if not school_score and not supply_score and not job_score:
        lines.append("- 학군, 공급 과잉, 직장 수요 등을 종합 평가")
        lines.append("- 점수가 낮을수록 좋은 입지입니다")

    lines.append("")

    # 법적 리스크
    legal_risk_score = risk_score.get("legal_risk_score", 0)
    lines.append(f"#### 3. 법적 리스크: {legal_risk_score}점 / 20점\n")
    if legal_risk_score == 0:
        lines.append("✅ **안전**: 법적 하자가 없습니다.")
    else:
        lines.append("⚠️ **주의**: 등기부상 문제가 있습니다.")
    lines.append("")


def _add_registry_info(lines: list, registry_data: Dict[str, Any]):
    """등기부 정보 섹션"""
    lines.append("## 📜 등기부 정보\n")

    # 근저당 정보
    mortgage_total = registry_data.get("mortgage_total", 0)
    lines.append(f"### 💰 근저당 설정\n")
    lines.append(f"- **총 근저당액**: {mortgage_total:,}만원")

    mortgages = registry_data.get("mortgages", [])
    if mortgages:
        lines.append(f"- **건수**: {len(mortgages)}건\n")
        for idx, mtg in enumerate(mortgages, 1):
            amount = mtg.get("amount", 0)
            creditor = mtg.get("creditor", "알 수 없음")
            lines.append(f"{idx}. {creditor}: {amount:,}만원")
    else:
        lines.append("- **건수**: 없음")
    lines.append("")

    # 압류/가압류
    lines.append("### ⚖️ 압류 및 가압류\n")
    seizure = registry_data.get("seizure_exists", False)
    provisional = registry_data.get("provisional_attachment_exists", False)

    lines.append(f"- **압류**: {'있음 🚨' if seizure else '없음 ✅'}")
    lines.append(f"- **가압류**: {'있음 🚨' if provisional else '없음 ✅'}")
    lines.append("")

"""
마크다운 형식 리포트 생성기

노션 스타일의 마크다운 리포트 생성

새로운 아키텍처:
1. build_risk_features_from_registry() - 등기부 → 리스크 특징 (100% 코드, LLM 없음)
2. build_llm_prompt() - 리스크 특징 → LLM용 프롬프트
3. generate_markdown_report() - 최종 마크다운 리포트 생성
"""
from typing import Dict, Any, Optional, List
from datetime import datetime
from ingest.registry_parser import RegistryDocument
from core.risk_engine import (
    RegistryRiskFeatures,
    calculate_jeonse_ratio,
    calculate_mortgage_ratio,
)


# ===========================
# 새로운 아키텍처 함수들
# ===========================
def build_risk_features_from_registry(
    registry_doc: RegistryDocument,
    contract_deposit: Optional[int] = None,
    contract_price: Optional[int] = None,
    property_value: Optional[int] = None,
) -> RegistryRiskFeatures:
    """
    RegistryDocument (파서 결과) → RegistryRiskFeatures (코드로 계산)

    LLM은 절대 사용하지 않음! 100% 규칙 기반 계산.

    Args:
        registry_doc: 파싱된 등기부 문서
        contract_deposit: 계약 보증금 (만원)
        contract_price: 계약 금액 (만원, 매매용)
        property_value: 물건 가치 (만원, 공시지가/감정가)

    Returns:
        코드로 계산된 리스크 특징
    """
    features = RegistryRiskFeatures(
        property_address=registry_doc.property_address,
        building_type=registry_doc.building_type,
        area_m2=registry_doc.area_m2,
    )

    # 1. 소유권 정보 (마스킹)
    if registry_doc.owner:
        features.owner_count = 1
        masked_name = registry_doc.owner.get_masked_name() or "미상"
        features.owner_names_masked = [masked_name]

    # 2. 근저당권 분석
    features.mortgage_count = len(registry_doc.mortgages)
    features.total_mortgage_amount = sum([m.amount or 0 for m in registry_doc.mortgages])
    features.mortgage_creditors = list(set([
        m.creditor for m in registry_doc.mortgages if m.creditor
    ]))

    # 최대 근저당 LTV 계산
    if property_value and property_value > 0:
        features.max_mortgage_ltv = (features.total_mortgage_amount / property_value) * 100

    # 3. 압류/가압류/가처분
    for seizure in registry_doc.seizures:
        if seizure.type == "압류":
            features.has_seizure = True
        elif seizure.type == "가압류":
            features.has_provisional_attachment = True
        elif seizure.type == "가처분":
            features.has_provisional_disposition = True

        features.seizure_count += 1
        features.seizure_total_amount += seizure.amount or 0

    # 4. 질권
    features.pledge_count = len(registry_doc.pledges)
    features.pledge_total_amount = sum([p.amount or 0 for p in registry_doc.pledges])

    # 5. 전세권
    features.lease_right_count = len(registry_doc.lease_rights)
    features.lease_right_total_amount = sum([lr.amount or 0 for lr in registry_doc.lease_rights])

    # 6. 리스크 지표 계산 (규칙 기반)
    if contract_deposit and property_value and property_value > 0:
        features.jeonse_ratio = calculate_jeonse_ratio(contract_deposit, property_value)

    if features.total_mortgage_amount and property_value and property_value > 0:
        features.mortgage_ratio = calculate_mortgage_ratio(
            features.total_mortgage_amount, property_value
        )

    # 총 부담 비율 (전세보증금 + 근저당 + 전세권)
    if property_value and property_value > 0:
        total_burden = (
            (contract_deposit or 0) +
            features.total_mortgage_amount +
            features.lease_right_total_amount
        )
        features.total_encumbrance_ratio = (total_burden / property_value) * 100

    # 7. 리스크 레벨 및 점수 계산 (규칙 기반)
    total_score = 0.0

    # 전세가율 점수 (최대 40점)
    jeonse_score = 0
    if features.jeonse_ratio:
        if features.jeonse_ratio >= 90:
            jeonse_score = 40
        elif features.jeonse_ratio >= 80:
            jeonse_score = 30
        elif features.jeonse_ratio >= 70:
            jeonse_score = 20
        else:
            jeonse_score = 10
        total_score += jeonse_score
        features.jeonse_ratio_score = jeonse_score

    # 근저당 비율 점수 (최대 30점)
    mortgage_score = 0
    if features.mortgage_ratio:
        if features.mortgage_ratio >= 80:
            mortgage_score = 30
        elif features.mortgage_ratio >= 60:
            mortgage_score = 20
        elif features.mortgage_ratio >= 40:
            mortgage_score = 10
        total_score += mortgage_score
        features.mortgage_ratio_score = mortgage_score

    # 권리하자 점수 (최대 30점)
    encumbrance_score = 0
    if features.has_seizure:
        encumbrance_score += 10
    if features.has_provisional_attachment:
        encumbrance_score += 10
    if features.has_provisional_disposition or features.pledge_count > 0:
        encumbrance_score += 10

    total_score += encumbrance_score
    features.encumbrance_score = encumbrance_score

    features.risk_score = total_score

    # 리스크 레벨 판정
    if total_score >= 71:
        features.risk_level = "심각"
    elif total_score >= 51:
        features.risk_level = "위험"
    elif total_score >= 31:
        features.risk_level = "주의"
    else:
        features.risk_level = "안전"

    return features


def build_llm_prompt(
    risk_features: RegistryRiskFeatures,
    contract_type: str,
    contract_deposit: Optional[int] = None,
    contract_price: Optional[int] = None,
    monthly_rent: Optional[int] = None,
) -> str:
    """
    RegistryRiskFeatures → LLM용 마크다운 프롬프트

    LLM은 이 프롬프트를 읽고 '해석/설명/추천'만 함.

    Args:
        risk_features: 코드로 계산된 리스크 특징
        contract_type: 계약 유형
        contract_deposit: 계약 보증금 (만원)
        contract_price: 계약 금액 (만원, 매매용)
        monthly_rent: 월세 (만원)

    Returns:
        LLM용 마크다운 프롬프트
    """
    lines = []

    # 헤더
    lines.append("# 부동산 계약 리스크 분석 데이터\n")
    lines.append("당신은 부동산 계약 리스크 분석 전문가입니다.")
    lines.append("아래 데이터를 바탕으로 사용자에게 친절하고 전문적인 분석 리포트를 작성하세요.\n")

    # 기본 정보
    lines.append("## 📊 계약 정보\n")
    lines.append(f"- **계약 유형**: {contract_type}")
    lines.append(f"- **주소**: {risk_features.property_address or '정보 없음'}")
    lines.append(f"- **건물 종류**: {risk_features.building_type or '정보 없음'}")
    lines.append(f"- **전용면적**: {risk_features.area_m2}㎡" if risk_features.area_m2 else "- **전용면적**: 정보 없음")

    if contract_type == "매매":
        lines.append(f"- **매매가**: {contract_price:,}만원" if contract_price else "- **매매가**: 정보 없음")
    else:
        lines.append(f"- **보증금**: {contract_deposit:,}만원" if contract_deposit else "- **보증금**: 정보 없음")
        if monthly_rent:
            lines.append(f"- **월세**: {monthly_rent:,}만원")

    lines.append("")

    # 소유권 정보
    lines.append("## 👤 소유권 정보\n")
    lines.append(f"- **소유자 수**: {risk_features.owner_count}명")
    if risk_features.owner_names_masked:
        lines.append(f"- **소유자**: {', '.join(risk_features.owner_names_masked)}")
    lines.append("")

    # 근저당권 정보
    lines.append("## 💰 근저당권 설정\n")
    lines.append(f"- **건수**: {risk_features.mortgage_count}건")
    lines.append(f"- **총 근저당액**: {risk_features.total_mortgage_amount:,}만원")
    if risk_features.max_mortgage_ltv:
        lines.append(f"- **근저당 LTV**: {risk_features.max_mortgage_ltv:.1f}%")
    if risk_features.mortgage_creditors:
        lines.append(f"- **채권자**: {', '.join(risk_features.mortgage_creditors)}")
    lines.append("")

    # 압류/가압류/가처분
    lines.append("## ⚖️ 압류 및 가압류\n")
    lines.append(f"- **압류**: {'있음 🚨' if risk_features.has_seizure else '없음 ✅'}")
    lines.append(f"- **가압류**: {'있음 🚨' if risk_features.has_provisional_attachment else '없음 ✅'}")
    lines.append(f"- **가처분**: {'있음 🚨' if risk_features.has_provisional_disposition else '없음 ✅'}")
    lines.append(f"- **총 건수**: {risk_features.seizure_count}건")
    lines.append(f"- **총 금액**: {risk_features.seizure_total_amount:,}만원")
    lines.append("")

    # 질권
    if risk_features.pledge_count > 0:
        lines.append("## 🔒 질권 설정\n")
        lines.append(f"- **건수**: {risk_features.pledge_count}건")
        lines.append(f"- **총 금액**: {risk_features.pledge_total_amount:,}만원")
        lines.append("")

    # 전세권
    if risk_features.lease_right_count > 0:
        lines.append("## 🏘️ 전세권 설정\n")
        lines.append(f"- **건수**: {risk_features.lease_right_count}건")
        lines.append(f"- **총 전세금**: {risk_features.lease_right_total_amount:,}만원")
        lines.append("")

    # 리스크 지표
    lines.append("## 📈 리스크 지표 (코드로 계산됨)\n")
    if risk_features.jeonse_ratio:
        lines.append(f"- **전세가율**: {risk_features.jeonse_ratio:.1f}% (점수: {risk_features.jeonse_ratio_score}점 / 40점)")
    if risk_features.mortgage_ratio:
        lines.append(f"- **근저당 비율**: {risk_features.mortgage_ratio:.1f}% (점수: {risk_features.mortgage_ratio_score}점 / 30점)")
    if risk_features.total_encumbrance_ratio:
        lines.append(f"- **총 부담 비율**: {risk_features.total_encumbrance_ratio:.1f}%")
    if risk_features.encumbrance_score is not None:
        lines.append(f"- **권리하자 점수**: {risk_features.encumbrance_score}점 / 30점")
    lines.append("")

    # 종합 리스크 평가
    lines.append("## ⚠️ 종합 리스크 평가\n")
    lines.append(f"- **리스크 레벨**: {risk_features.risk_level}")
    lines.append(f"- **총점**: {risk_features.risk_score}점 / 100점")
    lines.append("")

    # LLM 지침
    lines.append("---\n")
    lines.append("## 📝 분석 리포트 작성 지침\n")
    lines.append("위 데이터를 바탕으로 다음 내용을 포함한 분석 리포트를 작성하세요:\n")
    lines.append("1. **리스크 요약**: 주요 위험 요인을 3-5개 항목으로 요약")
    lines.append("2. **협상 포인트**: 계약 시 활용할 수 있는 협상 카드 제시")
    lines.append("3. **권장 조치**: 계약 전 반드시 해야 할 조치 사항 (법무사 상담, 전세보증금반환보증 가입 등)")
    lines.append("4. **종합 의견**: 전문가 관점에서의 계약 진행 여부 조언\n")
    lines.append("**주의사항**:")
    lines.append("- 법률 단정 표현은 피하고 '~할 수 있습니다', '~것으로 보입니다' 등 완곡한 표현 사용")
    lines.append("- 반드시 '법무사 또는 변호사 상담'을 권장할 것")
    lines.append("- 사용자가 이해하기 쉽게 설명할 것")

    return "\n".join(lines)


# ===========================
# 기존 마크다운 리포트 생성 함수
# ===========================


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

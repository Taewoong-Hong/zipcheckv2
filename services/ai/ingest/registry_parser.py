"""
등기부등본 파싱 및 구조화

전략:
1. 텍스트 PDF: PyMuPDF → 정규식 파서 (LLM 없음, 비용 0)
2. 이미지 PDF: Gemini Vision OCR → 정규식 파서 (LLM은 OCR만)

LLM으로 구조화 절대 금지! (hallucination + 불필요한 비용)
"""
import logging
import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import fitz  # PyMuPDF
from core.audit_logger import (
    log_parsing_error,
    log_parsing_success,
    log_parsing_warning,
    EventType
)

logger = logging.getLogger(__name__)


# ===========================
# 타임아웃 데코레이터 (regex 무한 루프 방지)
# ===========================
import signal
import functools

class RegexTimeoutError(Exception):
    """정규식 처리 타임아웃 예외"""
    pass


def timeout_handler(signum, frame):
    """시그널 핸들러 - 타임아웃 발생 시 호출"""
    raise RegexTimeoutError("정규식 처리 타임아웃 (30초 초과)")


def with_timeout(seconds: int = 30):
    """
    함수에 타임아웃을 적용하는 데코레이터

    사용법:
        @with_timeout(30)
        def slow_function():
            ...

    주의: Unix/Linux에서만 동작 (signal.SIGALRM 사용)
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Windows에서는 signal.SIGALRM이 없으므로 타임아웃 스킵
            if not hasattr(signal, 'SIGALRM'):
                return func(*args, **kwargs)

            # 기존 핸들러 저장
            old_handler = signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(seconds)  # 타임아웃 설정

            try:
                result = func(*args, **kwargs)
            finally:
                signal.alarm(0)  # 타임아웃 해제
                signal.signal(signal.SIGALRM, old_handler)  # 핸들러 복원

            return result
        return wrapper
    return decorator


# 입력 텍스트 크기 제한 (50KB) - catastrophic backtracking 방지
MAX_TEXT_SIZE = 50 * 1024  # 50KB


def truncate_text_if_needed(text: str) -> str:
    """텍스트 크기가 너무 크면 잘라냄"""
    if len(text) > MAX_TEXT_SIZE:
        logger.warning(f"⚠️ 텍스트 크기 제한 초과: {len(text)} > {MAX_TEXT_SIZE} bytes, 잘라냄")
        return text[:MAX_TEXT_SIZE]
    return text


# ===========================
# 개인정보 마스킹
# ===========================
def mask_personal_name(name: Optional[str]) -> Optional[str]:
    """
    개인 이름 마스킹: 홍길동 → 홍XX

    규칙:
    - 2자: 홍길 → 홍X
    - 3자: 홍길동 → 홍XX
    - 4자 이상: 홍길동순 → 홍XXX
    - 기업명 (캐피탈, 은행 등 키워드 포함): 마스킹 안 함
    """
    if not name:
        return None

    # 기업명 키워드 (마스킹 제외)
    corporate_keywords = ['캐피탈', '은행', '금융', '신협', '저축', '증권', '보험',
                          '주식회사', '(주)', '㈜', '유한회사', '재단', '협회']

    # 기업명이면 그대로 반환
    if any(keyword in name for keyword in corporate_keywords):
        return name

    # 개인 이름 마스킹
    name_len = len(name)
    if name_len <= 1:
        return name  # 1자는 마스킹 불가
    elif name_len == 2:
        return name[0] + 'X'
    else:
        return name[0] + 'X' * (name_len - 1)


# ===========================
# 등기부 데이터 모델
# ===========================
class OwnerInfo(BaseModel):
    """소유자 정보"""
    name: Optional[str] = None
    share_ratio: Optional[str] = None  # 지분 비율 (예: "1/2")
    registration_date: Optional[str] = None  # 등기일

    def get_masked_name(self) -> Optional[str]:
        """마스킹된 이름 반환"""
        return mask_personal_name(self.name)


class MortgageInfo(BaseModel):
    """근저당권 정보"""
    creditor: Optional[str] = None  # 채권자 (은행)
    amount: Optional[int] = None  # 채권최고액 (만원)
    debtor: Optional[str] = None  # 채무자
    registration_date: Optional[str] = None  # 설정일
    registration_number: Optional[str] = None  # 접수번호
    rank_number: Optional[str] = None  # 순위번호 (예: "1", "2")
    sub_rank_number: Optional[int] = None  # 부번호 (예: 1-6의 6)
    is_deleted: bool = False  # 말소 여부 (True면 말소됨)

    def get_masked_debtor(self) -> Optional[str]:
        """마스킹된 채무자 반환 (개인만)"""
        return mask_personal_name(self.debtor)


class SeizureInfo(BaseModel):
    """압류/가압류/가처분 정보 (갑구)"""
    type: str  # "압류" | "가압류" | "가처분"
    creditor: Optional[str] = None  # 채권자 (권리자)
    amount: Optional[int] = None  # 채권액 (만원)
    registration_date: Optional[str] = None  # 접수일
    description: Optional[str] = None  # 추가 설명
    rank_number: Optional[str] = None  # 순위번호 (예: "1", "2")
    sub_rank_number: Optional[int] = None  # 부번호 (예: 1-6의 6)
    is_deleted: bool = False  # 말소 여부 (True면 말소됨)


class PledgeInfo(BaseModel):
    """질권 정보 (을구)"""
    creditor: Optional[str] = None  # 질권자
    amount: Optional[int] = None  # 채권최고액 (만원)
    registration_date: Optional[str] = None  # 설정일
    is_deleted: bool = False  # 말소 여부 (True면 말소됨)


class LeaseRightInfo(BaseModel):
    """전세권 정보 (을구)"""
    lessee: Optional[str] = None  # 전세권자
    amount: Optional[int] = None  # 전세금 (만원)
    period_start: Optional[str] = None  # 존속기간 시작
    period_end: Optional[str] = None  # 존속기간 종료
    registration_date: Optional[str] = None  # 설정일
    is_deleted: bool = False  # 말소 여부 (True면 말소됨)


class RegistryDocument(BaseModel):
    """등기부등본 구조화 데이터"""
    # 표제부
    property_address: Optional[str] = None
    building_type: Optional[str] = None  # "아파트", "단독주택" 등
    area_m2: Optional[float] = None  # 전용면적 (m²)

    # 갑구 (소유권)
    owner: Optional[OwnerInfo] = None  # 단일 소유자 (간소화)

    # 갑구 (소유권 관련)
    seizures: List[SeizureInfo] = []  # 압류, 가압류, 가처분

    # 을구 (권리관계)
    mortgages: List[MortgageInfo] = []  # 근저당권
    pledges: List[PledgeInfo] = []  # 질권
    lease_rights: List[LeaseRightInfo] = []  # 전세권

    # 메타 정보
    issue_date: Optional[str] = None  # 발급일
    raw_text: Optional[str] = None  # 원본 텍스트 (디버깅용)

    def to_masked_dict(self) -> dict:
        """
        유저에게 보여줄 마스킹된 데이터 반환

        개인정보 마스킹:
        - 소유자 이름: 홍길동 → 홍XX
        - 채무자 이름: 홍길동 → 홍XX
        - 채권자 (기업): 하나캐피탈 → 그대로
        """
        return {
            "property_address": self.property_address,
            "building_type": self.building_type,
            "area_m2": self.area_m2,
            "owner": {
                "name": self.owner.get_masked_name() if self.owner else None,
                "share_ratio": self.owner.share_ratio if self.owner else None,
                "registration_date": self.owner.registration_date if self.owner else None,
            } if self.owner else None,
            "mortgages": [
                {
                    "rank_number": m.rank_number,  # 순위번호 (예: "1", "2")
                    "creditor": m.creditor,  # 기업명은 그대로
                    "amount": m.amount,
                    "debtor": m.get_masked_debtor(),  # 개인만 마스킹
                    "registration_date": m.registration_date,
                    "is_deleted": m.is_deleted,  # 말소 여부
                }
                for m in self.mortgages
            ],
            "seizures": [
                {
                    "type": s.type,
                    "creditor": s.creditor,  # 기업명은 그대로
                    "amount": s.amount,
                    "registration_date": s.registration_date,
                    "description": s.description,
                    "is_deleted": s.is_deleted,  # 말소 여부
                }
                for s in self.seizures
            ],
            "pledges": [
                {
                    "creditor": p.creditor,
                    "amount": p.amount,
                    "registration_date": p.registration_date,
                    "is_deleted": p.is_deleted,  # 말소 여부
                }
                for p in self.pledges
            ],
            "lease_rights": [
                {
                    "lessee": mask_personal_name(lr.lessee),  # 전세권자 마스킹
                    "amount": lr.amount,
                    "period_start": lr.period_start,
                    "period_end": lr.period_end,
                    "registration_date": lr.registration_date,
                    "is_deleted": lr.is_deleted,  # 말소 여부
                }
                for lr in self.lease_rights
            ],
            "issue_date": self.issue_date,
        }


# ===========================
# PDF 타입 감지
# ===========================
def is_text_extractable_pdf(pdf_path: str, min_chars: int = 500) -> tuple[bool, str]:
    """
    PDF가 텍스트 추출 가능한지 판별

    Returns:
        (is_text_pdf, extracted_text)
        - is_text_pdf: True면 텍스트 PDF, False면 이미지 PDF
        - extracted_text: 추출된 텍스트 (이미지 PDF면 빈 문자열)
    """
    try:
        doc = fitz.open(pdf_path)  # type: ignore
        texts = []
        for page in doc:
            texts.append(page.get_text("text"))
        doc.close()
        raw_text = "\n".join(texts).strip()

        # 텍스트가 충분히 추출되었는지 확인
        is_text_pdf = len(raw_text) >= min_chars

        logger.info(f"PDF 타입 감지: {'텍스트 PDF' if is_text_pdf else '이미지 PDF'} ({len(raw_text)}자)")
        return is_text_pdf, raw_text

    except Exception as e:
        logger.error(f"PDF 읽기 실패: {e}")
        return False, ""


# ===========================
# 요약페이지 파서 (말소 여부 판별의 핵심)
# ===========================
class SummaryData:
    """요약페이지에서 추출한 유효 항목들"""
    def __init__(self):
        self.owner_name: Optional[str] = None
        self.active_mortgage_amounts: List[int] = []  # 유효 근저당 금액 목록 (만원) - 순위번호 추출 실패 시 fallback용
        self.active_mortgage_ranks: List[str] = []  # 유효 근저당 순위번호 목록 (말소 판별의 핵심)
        self.active_seizure_types: List[str] = []  # 유효 압류 유형 목록 (임의경매개시결정, 압류 등)
        self.active_seizure_ranks: List[str] = []  # 유효 압류/가압류/가처분 순위번호 목록 (말소 판별의 핵심)
        self.has_summary: bool = False  # 요약 섹션 존재 여부


def parse_summary_section(text: str) -> SummaryData:
    """
    등기부 요약 섹션 파싱 (말소되지 않은 유효 항목만 포함)

    요약 섹션 구조:
    - 1. 소유지분현황 (갑구): 현재 소유자
    - 2. 소유지분을 제외한 소유권에 관한 사항 (갑구): 압류, 가압류, 경매 등
    - 3. (근)저당권 및 전세권 등 (을구): 근저당권, 전세권
    """
    summary = SummaryData()

    # 요약 섹션 찾기
    summary_patterns = [
        r'주요\s*등기사항\s*요약',
        r'주요등기사항요약',
        r'\[참고용\]',
    ]

    summary_start = -1
    for pattern in summary_patterns:
        match = re.search(pattern, text)
        if match:
            summary_start = match.start()
            break

    if summary_start == -1:
        logger.warning("⚠️ 요약 섹션을 찾을 수 없습니다. 전체 문서에서 파싱합니다.")
        return summary

    summary.has_summary = True
    summary_text = text[summary_start:]
    logger.info(f"📋 요약 섹션 발견 (위치: {summary_start}, 길이: {len(summary_text)}자)")

    # 1. 소유자 추출 (소유지분현황 섹션)
    # 패턴: "등기명의인" 행에서 이름 추출
    owner_patterns = [
        r'등기명의인[^\n]*\n[^\n]*?([가-힣]{2,10})\s*(?:\(소유자\)|\(소유\))?',  # 이월성 (소유자)
        r'소유자[:\s]*([가-힣]{2,10})',
        r'등기명의인\s+([가-힣]{2,10})',
    ]

    for pattern in owner_patterns:
        match = re.search(pattern, summary_text)
        if match:
            summary.owner_name = match.group(1).strip()
            logger.info(f"   └─ 소유자 (요약): {summary.owner_name}")
            break

    # 2. 압류/가압류/경매 추출 (섹션 2)
    # "소유지분을 제외한 소유권에 관한 사항" 또는 "2." 섹션
    section2_pattern = r'(?:소유지분을\s*제외한|2\.\s*소유)'
    section2_match = re.search(section2_pattern, summary_text)

    if section2_match:
        # 섹션 2 시작부터 섹션 3 시작 전까지
        section3_pattern = r'(?:저당권\s*및\s*전세권|3\.\s*\(근\)|을\s*구)'
        section3_match = re.search(section3_pattern, summary_text[section2_match.start():])

        if section3_match:
            section2_text = summary_text[section2_match.start():section2_match.start() + section3_match.start()]
        else:
            section2_text = summary_text[section2_match.start():section2_match.start() + 1000]

        # 등기목적 컬럼에서 유효 항목 추출
        seizure_keywords = ['압류', '가압류', '가처분', '임의경매', '강제경매', '경매개시']
        for keyword in seizure_keywords:
            if keyword in section2_text:
                summary.active_seizure_types.append(keyword)
                logger.info(f"   └─ 유효 압류/경매 (요약): {keyword}")

        # 순위번호 추출 (근저당과 동일한 방식)
        # 패턴: 줄 시작 또는 공백 뒤에 오는 숫자 (1~2자리)
        # 부번호 포함 (예: "1", "1-6", "6-1" 등 전체 캡처)
        seizure_rank_pattern = r'(?:^|\s)(\d{1,2}(?:-\d+)?)(?:\s|압류|가압류|가처분|경매|$)'

        found_seizure_ranks = set()
        for match in re.finditer(seizure_rank_pattern, section2_text, re.MULTILINE):
            rank = match.group(1)
            # 주순위번호 추출 (예: "1-6" -> "1")
            main_rank = rank.split('-')[0]
            if 1 <= int(main_rank) <= 30:
                found_seizure_ranks.add(rank)  # 부번호 포함된 전체 순위번호 저장

        # Fallback: 테이블 형식에서 첫 컬럼이 순위번호인 경우 (부번호 포함)
        if not found_seizure_ranks:
            row_pattern = r'^(\d{1,2}(?:-\d+)?)\s+'
            for match in re.finditer(row_pattern, section2_text, re.MULTILINE):
                rank = match.group(1)
                main_rank = rank.split('-')[0]
                if 1 <= int(main_rank) <= 30:
                    found_seizure_ranks.add(rank)

        # 순위번호 저장
        summary.active_seizure_ranks = list(found_seizure_ranks)
        logger.info(f"   └─ 유효 압류/가압류 순위번호 (요약): {sorted(found_seizure_ranks)}")

    # 3. 근저당권 추출 (섹션 3)
    # 요약 테이블에 나오는 근저당권은 모두 유효 (말소된 것은 요약에 없음)
    # 단순히 순위번호만 추출하면 됨
    section3_pattern = r'(?:저당권\s*및\s*전세권|3\.\s*\(근\)저당권)'
    section3_match = re.search(section3_pattern, summary_text)

    if section3_match:
        section3_text = summary_text[section3_match.start():]

        # 방법 1: 순위번호 패턴으로 직접 추출
        # 패턴: 줄 시작 또는 공백 뒤에 오는 숫자 (1~2자리)
        # 부번호 포함 (예: "1", "1-6", "6-1" 등 전체 캡처)
        rank_pattern = r'(?:^|\s)(\d{1,2}(?:-\d+)?)(?:\s|근저당|질권|전세권|$)'

        found_ranks = set()
        for match in re.finditer(rank_pattern, section3_text[:3000], re.MULTILINE):
            rank = match.group(1)
            # 주순위번호 추출 (예: "1-6" -> "1")
            main_rank = rank.split('-')[0]
            if 1 <= int(main_rank) <= 30:
                found_ranks.add(rank)  # 부번호 포함된 전체 순위번호 저장

        # 방법 2 (fallback): 테이블 형식에서 첫 컬럼이 순위번호인 경우
        # 패턴: 줄 시작의 숫자 (부번호 포함)
        if not found_ranks:
            row_pattern = r'^(\d{1,2}(?:-\d+)?)\s+'
            for match in re.finditer(row_pattern, section3_text[:3000], re.MULTILINE):
                rank = match.group(1)
                main_rank = rank.split('-')[0]
                if 1 <= int(main_rank) <= 30:
                    found_ranks.add(rank)

        # 순위번호 저장
        summary.active_mortgage_ranks = list(found_ranks)

        # 금액도 추출 (통계용)
        amount_pattern = r'금\s*([\d,]+)\s*원'
        for match in re.finditer(amount_pattern, section3_text[:3000]):
            amount_str = match.group(1).replace(',', '')
            try:
                amount_won = int(amount_str)
                amount_man = amount_won // 10000
                summary.active_mortgage_amounts.append(amount_man)
            except ValueError:
                pass

        logger.info(f"   └─ 유효 근저당 순위번호 (요약): {sorted(found_ranks)}")
        logger.info(f"   └─ 유효 근저당 금액 (요약): {len(summary.active_mortgage_amounts)}건")

    logger.info(f"📋 요약 파싱 완료: 소유자={summary.owner_name}, 근저당순위={len(summary.active_mortgage_ranks)}개, 압류순위={len(summary.active_seizure_ranks)}개, 압류유형={len(summary.active_seizure_types)}건")

    return summary


# ===========================
# 정규식 기반 파서
# ===========================
def extract_property_address(text: str) -> Optional[str]:
    """주소 추출 (표제부)"""
    # 패턴 1: [표제부] 다음 줄에 나오는 주소
    pattern1 = r'\[표제부\]\s*([^\n]+(?:시|구|동|리|읍|면)[^\n]+)'
    match = re.search(pattern1, text)
    if match:
        addr = match.group(1).strip()
        # 불필요한 문자 제거
        addr = re.sub(r'\s+', ' ', addr)
        return addr

    # 패턴 2: "소재지번" 또는 "소재지" 키워드
    pattern2 = r'소재지번?\s*[:：]?\s*([^\n]+(?:동|리|가)[^\n]*)'
    match = re.search(pattern2, text)
    if match:
        addr = match.group(1).strip()
        addr = re.sub(r'\s+', ' ', addr)
        return addr

    # 패턴 3: "경기도 ..." 형식 직접 찾기
    pattern3 = r'((?:서울|경기도|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]+(?:동|리|가)[^\n]+호)'
    match = re.search(pattern3, text)
    if match:
        addr = match.group(1).strip()
        addr = re.sub(r'\s+', ' ', addr)
        return addr

    return None


def extract_building_type(text: str) -> Optional[str]:
    """
    건물 유형 추출 (표제부)

    판별 기준:
    1. 표제부 용도가 '공동주택(아파트)' → 아파트
    2. 복합 건물의 경우: "N층 [주택유형]" 패턴에서 주택유형 추출
       - 예: "6층 다세대주택" → 다세대
       - 1층이 근린생활시설이어도 상위층 주택유형 우선
    3. 층수가 6층 이상 존재 → 아파트
    4. 기타 키워드 기반 판별
    """
    # 0. 아파트 관련 패턴 우선 확인 (가장 명확한 경우)
    apt_patterns = [
        r'공동주택\s*\(\s*아파트\s*\)',
        r'아파트',
    ]
    for pattern in apt_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            logger.info(f"   └─ 건물유형 (아파트 키워드): 아파트")
            return '아파트'

    # 1. 복합 건물 패턴: "N층 [주택유형]" (건물 내역 첫 줄)
    # 예: "6층 다세대주택", "5층 다가구주택", "7층 연립주택"
    # 이 패턴이 발견되면 해당 주택유형을 우선 사용 (복합건물 대응)
    total_floor_type_patterns = [
        (r'(\d{1,2})층\s*(다세대주택|다세대)', '다세대'),
        (r'(\d{1,2})층\s*(다가구주택|다가구)', '다가구'),
        (r'(\d{1,2})층\s*(연립주택|연립)', '연립'),
        (r'(\d{1,2})층\s*오피스텔', '오피스텔'),
    ]

    for pattern, building_type in total_floor_type_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            floor_num = match.group(1)
            logger.info(f"   └─ 건물유형 (총층수 패턴 {floor_num}층): {building_type}")
            return building_type

    # 2. 주택 유형 키워드 확인 (근린생활시설보다 주택 유형 우선)
    # 복합 건물에서 1층이 근린생활시설이어도 주택 유형이 있으면 그것을 사용
    residential_patterns = [
        (r'다세대주택', '다세대'),
        (r'다세대', '다세대'),
        (r'다가구주택', '다가구'),
        (r'다가구', '다가구'),
        (r'연립주택', '연립'),
        (r'단독주택', '단독주택'),
        (r'오피스텔', '오피스텔'),
    ]

    for pattern, building_type in residential_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            logger.info(f"   └─ 건물유형 (주택 키워드): {building_type}")
            return building_type

    # 3. 근린생활시설만 있는 경우 (순수 상가 건물)
    if re.search(r'근린생활시설', text, re.IGNORECASE):
        # 주택 관련 키워드가 없는지 다시 확인
        if not re.search(r'(다세대|다가구|연립|단독주택|주택)', text, re.IGNORECASE):
            logger.info(f"   └─ 건물유형 (순수 상가): 근린생활주택")
            return '근린생활주택'

    # 4. 층수 확인 (6층 이상이면 아파트)
    # 패턴: "7층", "10층", "15층" 등
    floor_pattern = r'(\d{1,2})층\s*[\d,.]+'
    floor_matches = re.findall(floor_pattern, text)

    if floor_matches:
        max_floor = max(int(f) for f in floor_matches)
        if max_floor >= 6:
            logger.info(f"   └─ 건물유형 (층수 {max_floor}층 ≥ 6층): 아파트")
            return '아파트'

    # 5. 건물 내역에서 층수 확인 (예: "제4층 제406호")
    unit_floor_pattern = r'제\s*(\d{1,2})\s*층'
    unit_floor_matches = re.findall(unit_floor_pattern, text)

    if unit_floor_matches:
        max_unit_floor = max(int(f) for f in unit_floor_matches)
        # 호수가 있는 건물이면서 높은 층이면 아파트/오피스텔
        if max_unit_floor >= 6:
            logger.info(f"   └─ 건물유형 (호수 층 {max_unit_floor}층 ≥ 6층): 아파트")
            return '아파트'

    logger.info("   └─ 건물유형: 판별 불가 (N/A)")
    return None


def extract_exclusive_area(text: str) -> Optional[float]:
    """
    전용면적 추출 (표제부)

    패턴:
    - "68.04㎡" 또는 "68.04m²" 또는 "68.04m2"
    - 표제부의 "전유부분의 건물의 표시" > "건물 내역"에서 추출
    - "철근콘크리트조 68.04㎡" 형태
    """
    # 1. "전유부분의 건물의 표시" 섹션 찾기 (가장 정확한 위치)
    jeonyu_patterns = [
        r'전유부분의?\s*건물의?\s*표시',
        r'전유부분',
    ]

    jeonyu_start = -1
    for pattern in jeonyu_patterns:
        match = re.search(pattern, text)
        if match:
            jeonyu_start = match.start()
            logger.info(f"   └─ 전유부분 섹션 발견 (위치: {jeonyu_start})")
            break

    if jeonyu_start == -1:
        logger.info("   └─ 전유부분 섹션 없음, 표제부 전체에서 검색")
        jeonyu_start = 0

    # 전유부분 섹션 범위 (전유부분부터 대지권 또는 갑구 전까지)
    section_end_patterns = [
        r'대지권의\s*표시',
        r'【\s*갑\s*구\s*】',
        r'\[\s*갑\s*구\s*\]',
        r'갑\s*구',
    ]

    jeonyu_end = len(text)
    for pattern in section_end_patterns:
        match = re.search(pattern, text[jeonyu_start:])
        if match:
            jeonyu_end = jeonyu_start + match.start()
            break

    jeonyu_section = text[jeonyu_start:jeonyu_end]
    logger.info(f"   └─ 전유부분 섹션 길이: {len(jeonyu_section)}자")
    logger.info(f"   └─ 전유부분 섹션 끝 위치: {jeonyu_end}, 전체 텍스트 길이: {len(text)}")

    # 디버깅: 면적 패턴이 전체 텍스트에서 어디에 있는지 확인
    area_debug_pattern = r'(\d{2,3}\.\d{1,5})\s*[㎡m²m2]'
    all_areas = re.findall(area_debug_pattern, text)
    if all_areas:
        logger.info(f"   └─ [DEBUG] 전체 텍스트에서 발견된 면적 후보: {all_areas}")

    # 2. "건물 내역" 컬럼에서 면적 추출
    # 패턴: "철근콘크리트구조 59.9818㎡" 또는 "철근콘크리트조 68.04㎡"
    # 소수점 자릿수: 1~5자리 (68.0, 68.04, 59.9818 등)
    # 단위 패턴: ㎡ (단일문자), m² (두 문자), m2, 제곱미터, 평 등
    area_unit_pattern = r'(?:㎡|m²|m2|제곱미터|㎡)'

    building_detail_patterns = [
        # 구조 + 면적 (공백/줄바꿈 허용, 소수점 1~5자리)
        rf'(?:철근콘크리트구조|철근콘크리트조|철골철근콘크리트조|철골조|조적조|목조|벽돌조|블록조)[\s\n]*([\d]+\.[\d]{{1,5}})\s*{area_unit_pattern}?',
        # 구조 + 면적 (㎡ 바로 붙은 경우)
        rf'(?:철근콘크리트구조|철근콘크리트조|철골철근콘크리트조|철골조|조적조|목조|벽돌조|블록조)[\s\n]*([\d]+\.[\d]{{1,5}}){area_unit_pattern}',
        # 숫자.소수점 + 단위 (구조 키워드 없이, 소수점 1~5자리)
        rf'([\d]+\.[\d]{{1,5}})\s*{area_unit_pattern}',
        # 숫자.소수점만 (단위 없이, 소수점 4자리 이상이면 면적일 가능성 높음)
        r'([\d]+\.[\d]{4,5})',
    ]

    logger.info(f"   └─ 전유부분 섹션 내용 미리보기: {jeonyu_section[:300]}...")

    for pattern in building_detail_patterns:
        match = re.search(pattern, jeonyu_section)
        if match:
            try:
                area = float(match.group(1))
                # 유효한 전용면적 범위 (10㎡ ~ 300㎡)
                if 10 <= area <= 300:
                    logger.info(f"   └─ 전용면적 (건물내역): {area}㎡")
                    return area
            except ValueError:
                continue

    # 3. Fallback: 전유부분 섹션에서 가장 작은 합리적인 면적 찾기
    # 단, 대지권 비율 등의 숫자는 제외
    fallback_area_pattern = rf'([\d.]+)\s*{area_unit_pattern}'
    matches = re.findall(fallback_area_pattern, jeonyu_section)

    valid_areas = []
    for match in matches:
        try:
            area = float(match)
            # 전용면적 합리적 범위 (20㎡ ~ 200㎡)
            # 너무 작거나 큰 값은 대지 면적이거나 공용면적
            if 20 <= area <= 200:
                valid_areas.append(area)
        except ValueError:
            continue

    if valid_areas:
        # 전유부분에서 찾은 면적 중 가장 작은 값 (전용면적)
        exclusive_area = min(valid_areas)
        logger.info(f"   └─ 전용면적 (fallback): {exclusive_area}㎡ (후보: {valid_areas})")
        return exclusive_area

    # 4. 최종 Fallback: 전체 텍스트에서 소수점 4자리 이상인 숫자 찾기 (면적일 가능성 높음)
    logger.info("   └─ 전유부분 섹션에서 면적 없음, 전체 텍스트에서 재검색...")
    final_fallback_pattern = r'([\d]+\.[\d]{4,5})'
    final_matches = re.findall(final_fallback_pattern, text)

    final_valid_areas = []
    for match in final_matches:
        try:
            area = float(match)
            if 20 <= area <= 200:
                final_valid_areas.append(area)
        except ValueError:
            continue

    if final_valid_areas:
        exclusive_area = min(final_valid_areas)
        logger.info(f"   └─ 전용면적 (전체 텍스트 fallback): {exclusive_area}㎡ (후보: {final_valid_areas})")
        return exclusive_area

    logger.info("   └─ 전용면적: 추출 실패 (N/A)")
    return None


def extract_owner_name(text: str) -> Optional[str]:
    """소유자 이름 추출 (갑구)"""
    # 패턴: "소유자" 다음에 나오는 이름
    pattern = r'소유자\s*[:：]?\s*([가-힣]+)'
    match = re.search(pattern, text)
    if match:
        return match.group(1).strip()
    return None


def extract_mortgages(text: str, summary: Optional[SummaryData] = None) -> List[MortgageInfo]:
    """
    근저당권 추출 (을구)

    말소 판별 로직 (우선순위):
    1. 요약 섹션이 있으면: 요약에 있는 금액만 유효, 나머지 말소
    2. 요약 섹션이 없으면: 텍스트 키워드 기반 판별 (fallback)

    순위번호 처리:
    - 같은 순위번호 내에서 기타사항 수정 시 1-1, 1-2, ... 1-6 형식으로 부번호 증가
    - 부번호가 있는 경우, 같은 주순위번호 중 가장 높은 부번호만 유지 (최신 버전)
    """
    mortgages = []

    # 패턴: 채권최고액, 채권자, 채무자, 순위번호 추출
    # 예: "채권최고액 금 1,172,400,000원"
    amount_pattern = r'채권최고액\s*금?\s*([\d,]+)\s*원'
    creditor_pattern = r'(?:근저당권자|채권자)\s*[:：]?\s*([^\n]+?)(?:\s|$)'
    debtor_pattern = r'채무자\s*[:：]?\s*([가-힣]+)'

    # 순위번호 패턴: "1", "1-1", "1-6", "2", "2-3" 등
    # 앞쪽 컨텍스트에서 순위번호 찾기 (숫자-숫자 또는 단독 숫자)
    rank_pattern = r'(?:순위번호|순위)\s*[:：]?\s*(\d+)(?:-(\d+))?|^(\d+)(?:-(\d+))?\s'

    # 요약 기반 유효 항목 (복사본 사용)
    # 단순 순위번호 매칭: 요약에 있는 순위번호면 유효
    active_ranks = set(summary.active_mortgage_ranks) if summary and summary.has_summary else set()
    active_amounts = list(summary.active_mortgage_amounts) if summary and summary.has_summary else []

    # 순위번호 기반 매칭 사용 여부
    use_rank_matching = bool(active_ranks)

    if use_rank_matching:
        logger.info(f"말소 판별: 순위번호 매칭 사용 (유효 순위: {sorted(active_ranks)})")
    else:
        logger.info(f"말소 판별: 금액 기반 매칭 사용 (유효 금액: {active_amounts})")

    # 모든 근저당권 찾기
    for amount_match in re.finditer(amount_pattern, text):
        amount_str = amount_match.group(1).replace(',', '')
        amount_won = int(amount_str)
        amount_man = amount_won // 10000  # 만원 단위

        # 근처에서 채권자/채무자/순위번호 찾기 (앞뒤 300자 범위로 확대)
        start = max(0, amount_match.start() - 300)
        end = min(len(text), amount_match.end() + 200)
        context = text[start:end]

        # 앞쪽 컨텍스트에서 순위번호 추출 (가장 가까운 것)
        front_context = text[start:amount_match.start()]
        rank_number = None
        sub_rank_number = None

        # 순위번호 찾기 (여러 패턴 시도)
        rank_patterns = [
            r'순위번호\s*[:：]?\s*(\d+)(?:-(\d+))?',  # "순위번호: 1-6"
            r'(?:^|\s)(\d+)(?:-(\d+))?\s+근저당권',  # "1-6 근저당권"
            r'(?:^|\n)\s*(\d+)(?:-(\d+))?\s',  # 줄 시작 "1-6 "
        ]

        for rp in rank_patterns:
            rank_matches = list(re.finditer(rp, front_context, re.MULTILINE))
            if rank_matches:
                # 가장 마지막 (가까운) 매치 사용
                last_match = rank_matches[-1]
                num = last_match.group(1)
                sub = last_match.group(2) if last_match.lastindex and last_match.lastindex >= 2 else None
                if num:
                    # "1-6" 형태로 full rank 저장 (요약과 동일한 형식)
                    if sub:
                        rank_number = f"{num}-{sub}"
                        sub_rank_number = int(sub)
                    else:
                        rank_number = num
                    break

        creditor = None
        creditor_match = re.search(creditor_pattern, context)
        if creditor_match:
            creditor = creditor_match.group(1).strip()

        debtor = None
        debtor_match = re.search(debtor_pattern, context)
        if debtor_match:
            debtor = debtor_match.group(1).strip()

        # 말소 여부 판별 (순위번호 기반: 요약 우선)
        if summary and summary.has_summary:
            is_deleted = True  # 기본값: 말소 (요약에서 찾지 못하면 말소)

            if use_rank_matching and rank_number:
                # 순위번호 매칭: 요약의 유효 순위번호에 있으면 유효
                if rank_number in active_ranks:
                    is_deleted = False
                    logger.info(f"   └─ 순위 {rank_number} 근저당 ({amount_man:,}만원): 유효 (순위번호 매칭)")
                else:
                    logger.info(f"   └─ 순위 {rank_number} 근저당 ({amount_man:,}만원): 말소 (요약에 순위 없음)")
            elif use_rank_matching and not rank_number:
                # 순위번호를 추출 못했으면 금액으로 fallback
                for i, active_amount in enumerate(active_amounts):
                    if abs(amount_man - active_amount) <= 1:
                        is_deleted = False
                        active_amounts.pop(i)
                        logger.info(f"   └─ 근저당 ({amount_man:,}만원): 유효 (금액 fallback)")
                        break
            else:
                # Fallback: 금액 기반 판별 (순위번호가 없는 경우)
                for i, active_amount in enumerate(active_amounts):
                    if abs(amount_man - active_amount) <= 1:
                        is_deleted = False
                        active_amounts.pop(i)
                        break
        else:
            # Fallback: 텍스트 키워드 기반 판별
            deletion_keywords = ['말소', '해지', '말소기준등기', '말소됨', '해제']
            is_deleted = any(keyword in context for keyword in deletion_keywords)

        mortgages.append(MortgageInfo(
            creditor=creditor,
            amount=amount_man,
            debtor=debtor,
            rank_number=rank_number,
            sub_rank_number=sub_rank_number,
            is_deleted=is_deleted
        ))

    # 중복 제거: 같은 순위번호 내에서 가장 높은 부번호만 유지
    mortgages = deduplicate_mortgages_by_rank(mortgages)

    return mortgages


def deduplicate_mortgages_by_rank(mortgages: List[MortgageInfo]) -> List[MortgageInfo]:
    """
    같은 순위번호 내에서 가장 높은 부번호(sub_rank_number)만 유지

    예: 1-1, 1-2, 1-6 → 1-6만 유지 (가장 최신 버전)

    규칙:
    - rank_number가 같고 sub_rank_number가 다른 경우, 가장 높은 것만 유지
    - rank_number가 None인 항목은 그대로 유지
    - 말소된 항목(is_deleted=True)도 포함하여 처리
    """
    if not mortgages:
        return mortgages

    # rank_number가 None인 항목과 있는 항목 분리
    no_rank_mortgages = [m for m in mortgages if m.rank_number is None]
    ranked_mortgages = [m for m in mortgages if m.rank_number is not None]

    if not ranked_mortgages:
        return mortgages

    # 같은 rank_number별로 그룹화
    from collections import defaultdict
    rank_groups: Dict[str, List[MortgageInfo]] = defaultdict(list)

    for m in ranked_mortgages:
        if m.rank_number is not None:  # Type guard for Pylance
            rank_groups[m.rank_number].append(m)

    # 각 그룹에서 가장 높은 sub_rank_number를 가진 항목만 선택
    deduplicated = []
    for rank_num, group in rank_groups.items():
        if len(group) == 1:
            # 그룹에 1개만 있으면 그대로 추가
            deduplicated.append(group[0])
        else:
            # 여러 개 있으면 sub_rank_number가 가장 높은 것 선택
            # sub_rank_number가 None인 경우 0으로 처리
            sorted_group = sorted(
                group,
                key=lambda x: x.sub_rank_number if x.sub_rank_number is not None else 0,
                reverse=True
            )
            highest = sorted_group[0]

            logger.info(
                f"   └─ 순위번호 {rank_num} 중복 제거: "
                f"{len(group)}개 → 1개 유지 (부번호: {highest.sub_rank_number or '없음'})"
            )

            deduplicated.append(highest)

    # 순위번호 없는 항목 + 중복 제거된 항목 합치기
    result = no_rank_mortgages + deduplicated

    # 원래 순서 유지를 위해 정렬 (rank_number 기준)
    result.sort(key=lambda x: (
        int(x.rank_number) if x.rank_number and x.rank_number.isdigit() else 999,
        x.sub_rank_number or 0
    ))

    return result


def extract_seizures(text: str, summary: Optional[SummaryData] = None) -> List[SeizureInfo]:
    """
    압류/가압류/가처분 추출 (갑구) - 근저당(을구)과 동일한 방식

    동작 방식:
    1. 표제부 갑구에서 모든 압류/가압류/가처분 등기목적 찾기
    2. 해당 항목의 순위번호, 권리자/채권자 추출
    3. 요약(참고용) 갑구의 순위번호와 매칭
    4. 요약에 있으면 유효(is_deleted=False), 없으면 말소(is_deleted=True)
    5. 모든 항목 반환 (유효+말소 모두)

    순위번호 추출: 근저당과 동일한 패턴 사용
    채권자 추출: "권리자/채권자" 키워드 다음 단어 추출
    """
    seizures = []

    # 이미 처리한 순위번호 추적 (중복 방지)
    processed_ranks: set = set()

    # 등기목적 키워드 → 압류 유형 매핑
    seizure_keywords = {
        '임의경매개시결정': '압류',
        '강제경매개시결정': '압류',
        '임의경매': '압류',
        '강제경매': '압류',
        '경매개시': '압류',
        '가압류': '가압류',
        '가처분': '가처분',
        '압류': '압류',
    }

    # 요약에서 유효 순위번호 (말소 판별의 핵심)
    active_ranks = set(summary.active_seizure_ranks) if summary and summary.has_summary else set()

    logger.info(f"압류 추출 시작: 요약 유효 순위번호={sorted(active_ranks) if active_ranks else '없음'}")

    # 말소 여부 판별 키워드 (요약 없을 때 fallback용)
    deletion_keywords = ['말소', '해지', '말소기준등기', '말소됨', '해제', '취하']

    # 채권자로 잘못 추출되면 안 되는 단어들
    invalid_creditors = {
        '가압류', '가처분', '압류', '경매', '개시결정', '결정', '등기',
        '말소', '해제', '해지', '취하', '년', '월', '일', '등', '호',
        '소유권', '이전', '설정', '근저당', '전세권', '임의', '강제',
        '기입', '촉탁', '신청', '접수', '완료', '처분', '금지', '가등기',
        '채권자', '권리자', '신청인', '의하여', '대하여', '청구',
        '주식회사', '유한회사', '합자회사', '합명회사',
        '및', '기타사항', '기타', '사항', '원',
        '법원', '지방법원', '중앙지방법원', '고등법원', '대법원',
    }

    def is_registration_number(s: str) -> bool:
        """접수번호 패턴 체크 (제XXXX호)"""
        return bool(re.match(r'^제?\d+호?$', s.strip()))

    # 키워드별로 모든 발생 위치 찾기
    for keyword, seizure_type in seizure_keywords.items():
        if keyword not in text:
            continue

        for keyword_match in re.finditer(re.escape(keyword), text):
            keyword_pos = keyword_match.start()

            # 컨텍스트 추출 (앞 300자, 뒤 400자)
            start = max(0, keyword_pos - 300)
            end = min(len(text), keyword_pos + 400)
            context = text[start:end]
            front_context = text[start:keyword_pos]

            # ========================================
            # 1. 순위번호 추출 (근저당과 동일한 패턴)
            # ========================================
            rank_number = None
            sub_rank_number = None

            # 근저당과 동일한 순위번호 패턴
            rank_patterns = [
                r'순위번호\s*[:：]?\s*(\d+)(?:-(\d+))?',  # "순위번호: 1-6"
                r'(?:^|\n)\s*(\d+)(?:-(\d+))?\s+(?:압류|가압류|가처분|경매)',  # "1 압류"
                r'(?:^|\n)\s*(\d+)(?:-(\d+))?\s{2,}',  # "1   " (테이블)
                r'(?:^|\n)(\d+)(?:-(\d+))?\t',  # 탭 구분
            ]

            for rp in rank_patterns:
                rank_matches = list(re.finditer(rp, front_context, re.MULTILINE))
                if rank_matches:
                    last_match = rank_matches[-1]
                    num = last_match.group(1)
                    sub = last_match.group(2) if last_match.lastindex and last_match.lastindex >= 2 else None
                    if num and num.isdigit() and 1 <= int(num) <= 30:
                        # "1-6" 형태로 full rank 저장 (요약과 동일한 형식)
                        if sub:
                            rank_number = f"{num}-{sub}"
                            sub_rank_number = int(sub)
                        else:
                            rank_number = num
                        break

            # 🛟 Fallback: 바로 윗줄이 "숫자만 있는 줄"인 경우 (예: "15\n압류")
            # 실제 PDF 텍스트 구조: 순위번호가 별도 줄에 있고, 다음 줄에 "압류" 등이 옴
            if rank_number is None:
                lines = front_context.rstrip().splitlines()
                for line in reversed(lines):
                    m = re.match(r'\s*(\d{1,2})(?:-(\d+))?\s*$', line)
                    if m:
                        num = m.group(1)
                        sub = m.group(2)
                        if num.isdigit() and 1 <= int(num) <= 30:
                            if sub:
                                rank_number = f"{num}-{sub}"
                                sub_rank_number = int(sub)
                            else:
                                rank_number = num
                        break

            # 중복 체크: 같은 순위번호는 한 번만 처리
            rank_key = f"{rank_number or 'none'}_{keyword_pos // 200}"
            if rank_key in processed_ranks:
                continue
            processed_ranks.add(rank_key)

            # ========================================
            # 2. 채권자/권리자 추출 (키워드 다음 단어)
            # ========================================
            creditor = None
            creditor_pattern = r'(?:권리자|채권자|신청인|신청권자)\s*[:：]?\s*([가-힣a-zA-Z0-9]+(?:[\(（][^\)）]+[\)）])?)'

            creditor_match = re.search(creditor_pattern, context)
            if creditor_match:
                candidate = creditor_match.group(1).strip()
                if (candidate and len(candidate) >= 2 and
                    candidate not in invalid_creditors and
                    not is_registration_number(candidate)):
                    creditor = candidate

            # ========================================
            # 3. 금액 추출 (있을 경우)
            # ========================================
            amount = None
            amount_pattern = r'(?:청구금액|채권금액|금)\s*([\d,]+)\s*원'
            amount_match = re.search(amount_pattern, context)
            if amount_match:
                amount_str = amount_match.group(1).replace(',', '')
                amount = int(amount_str) // 10000

            # ========================================
            # 4. 말소 여부 판별 (요약 우선, 근저당과 동일)
            # ========================================
            if summary and summary.has_summary:
                # 요약이 있으면: 요약에 순위번호가 있으면 유효, 없으면 말소
                is_deleted = True  # 기본값: 말소

                if rank_number:
                    if rank_number in active_ranks:
                        is_deleted = False
                        logger.info(f"   └─ 순위 {rank_number} {seizure_type}: 유효 (요약에 존재)")
                    else:
                        logger.info(f"   └─ 순위 {rank_number} {seizure_type}: 말소 (요약에 없음)")
                else:
                    # 순위번호 없으면 키워드 말소 체크
                    is_deleted = any(del_kw in context for del_kw in deletion_keywords)
                    logger.info(f"   └─ 순위번호 없음 {seizure_type}: {'말소' if is_deleted else '유효'} (키워드 체크)")
            else:
                # 요약 없으면: 텍스트 키워드 기반 판별
                is_deleted = any(del_kw in context for del_kw in deletion_keywords)

            # ========================================
            # 5. 결과 추가 (모든 항목, 유효+말소)
            # ========================================
            seizures.append(SeizureInfo(
                type=seizure_type,
                creditor=creditor,
                amount=amount,
                description=keyword,
                rank_number=rank_number,
                sub_rank_number=sub_rank_number,
                is_deleted=is_deleted
            ))

    # 중복 제거: 같은 순위번호 내에서 가장 높은 부번호만 유지
    seizures = deduplicate_seizures_by_rank(seizures)

    logger.info(f"압류 추출 완료: 총 {len(seizures)}건 (유효: {sum(1 for s in seizures if not s.is_deleted)}건, 말소: {sum(1 for s in seizures if s.is_deleted)}건)")

    return seizures


def deduplicate_seizures_by_rank(seizures: List[SeizureInfo]) -> List[SeizureInfo]:
    """
    같은 순위번호 내에서 가장 높은 부번호(sub_rank_number)만 유지

    예: 1-1, 1-2, 1-6 → 1-6만 유지 (가장 최신 버전)

    규칙:
    - rank_number가 같고 sub_rank_number가 다른 경우, 가장 높은 것만 유지
    - rank_number가 None인 항목은 채권자+유형 조합으로 중복 제거
    - 말소된 항목(is_deleted=True)도 포함하여 처리
    """
    if not seizures:
        return seizures

    # rank_number가 None인 항목과 있는 항목 분리
    no_rank_seizures = [s for s in seizures if s.rank_number is None]
    ranked_seizures = [s for s in seizures if s.rank_number is not None]

    # 순위번호 없는 항목도 채권자+유형 조합으로 중복 제거
    if no_rank_seizures:
        seen_keys: set = set()
        deduplicated_no_rank = []
        for s in no_rank_seizures:
            # 채권자 + 유형 조합으로 키 생성 (채권자가 없으면 유형만 사용)
            key = (s.creditor or "", s.type)
            if key not in seen_keys:
                seen_keys.add(key)
                deduplicated_no_rank.append(s)
            else:
                logger.info(f"   └─ 압류 중복 제거 (순위번호 없음): 채권자={s.creditor}, 유형={s.type}")
        no_rank_seizures = deduplicated_no_rank

    if not ranked_seizures:
        return no_rank_seizures

    # 같은 rank_number별로 그룹화
    from collections import defaultdict
    rank_groups: Dict[str, List[SeizureInfo]] = defaultdict(list)

    for s in ranked_seizures:
        if s.rank_number is not None:  # Type guard for Pylance
            rank_groups[s.rank_number].append(s)

    # 각 그룹에서 가장 높은 sub_rank_number를 가진 항목만 선택
    deduplicated = []
    for rank_num, group in rank_groups.items():
        if len(group) == 1:
            deduplicated.append(group[0])
        else:
            # 여러 개 있으면 sub_rank_number가 가장 높은 것 선택
            sorted_group = sorted(
                group,
                key=lambda x: x.sub_rank_number if x.sub_rank_number is not None else 0,
                reverse=True
            )
            highest = sorted_group[0]

            logger.info(
                f"   └─ 압류 순위번호 {rank_num} 중복 제거: "
                f"{len(group)}개 → 1개 유지 (부번호: {highest.sub_rank_number or '없음'})"
            )

            deduplicated.append(highest)

    # 순위번호 없는 항목 + 중복 제거된 항목 합치기
    result = no_rank_seizures + deduplicated

    # 원래 순서 유지를 위해 정렬 (rank_number 기준)
    result.sort(key=lambda x: (
        int(x.rank_number) if x.rank_number and x.rank_number.isdigit() else 999,
        x.sub_rank_number or 0
    ))

    return result


def extract_pledges(text: str) -> List[PledgeInfo]:
    """질권 추출 (을구)"""
    pledges = []

    # 패턴: "질권" + 채권최고액
    if '질권' not in text:
        return pledges

    # 말소 여부 판별 키워드
    deletion_keywords = ['말소', '해지', '말소기준등기', '말소됨', '해제']

    # 금액 패턴
    amount_pattern = r'질권[^0-9]{0,100}금?\s*([\d,]+)\s*원'

    for amount_match in re.finditer(amount_pattern, text):
        amount_str = amount_match.group(1).replace(',', '')
        amount_won = int(amount_str)
        amount_man = amount_won // 10000  # 만원 단위

        # 근처에서 질권자 찾기
        start = max(0, amount_match.start() - 200)
        end = min(len(text), amount_match.end() + 200)
        context = text[start:end]

        creditor = None
        creditor_pattern = r'질권자\s*[:：]?\s*([^\n]+?)(?:\s|$)'
        creditor_match = re.search(creditor_pattern, context)
        if creditor_match:
            creditor = creditor_match.group(1).strip()

        # 말소 여부 판별
        is_deleted = any(keyword in context for keyword in deletion_keywords)

        pledges.append(PledgeInfo(
            creditor=creditor,
            amount=amount_man,
            is_deleted=is_deleted
        ))

    return pledges


def extract_lease_rights(text: str) -> List[LeaseRightInfo]:
    """전세권 추출 (을구)"""
    lease_rights = []

    # 패턴: "전세권" + 전세금
    if '전세권' not in text:
        return lease_rights

    # 말소 여부 판별 키워드
    deletion_keywords = ['말소', '해지', '말소기준등기', '말소됨', '해제']

    # 금액 패턴
    amount_pattern = r'전세금?\s*금?\s*([\d,]+)\s*원'

    for amount_match in re.finditer(amount_pattern, text):
        amount_str = amount_match.group(1).replace(',', '')
        amount_won = int(amount_str)
        amount_man = amount_won // 10000  # 만원 단위

        # 근처에서 전세권자 찾기
        start = max(0, amount_match.start() - 200)
        end = min(len(text), amount_match.end() + 200)
        context = text[start:end]

        lessee = None
        lessee_pattern = r'전세권자\s*[:：]?\s*([가-힣]+)'
        lessee_match = re.search(lessee_pattern, context)
        if lessee_match:
            lessee = lessee_match.group(1).strip()

        # 존속기간 찾기
        period_pattern = r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일부터\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일까지'
        period_match = re.search(period_pattern, context)
        period_start = None
        period_end = None
        if period_match:
            period_start = f"{period_match.group(1)}-{period_match.group(2):0>2}-{period_match.group(3):0>2}"
            period_end = f"{period_match.group(4)}-{period_match.group(5):0>2}-{period_match.group(6):0>2}"

        # 말소 여부 판별
        is_deleted = any(keyword in context for keyword in deletion_keywords)

        lease_rights.append(LeaseRightInfo(
            lessee=lessee,
            amount=amount_man,
            period_start=period_start,
            period_end=period_end,
            is_deleted=is_deleted
        ))

    return lease_rights


@with_timeout(30)  # 30초 타임아웃 - catastrophic backtracking 방지
def parse_with_regex(raw_text: str) -> RegistryDocument:
    """
    정규식 기반 등기부 파싱 (LLM 없음)

    파싱 순서:
    1. 요약 섹션 먼저 파싱 (말소 여부 판별의 핵심)
    2. 요약 정보를 각 추출 함수에 전달
    3. 요약에 있는 항목만 유효, 나머지는 말소 처리

    안전장치:
    - 30초 타임아웃 (무한 루프 방지)
    - 50KB 텍스트 크기 제한 (catastrophic backtracking 방지)
    """
    import time
    start_time = time.time()

    logger.info("🔍 [R-STEP 1] parse_with_regex 진입")

    # 안전장치: 텍스트 크기 제한 (catastrophic backtracking 방지)
    raw_text = truncate_text_if_needed(raw_text)
    logger.info(f"🔍 [R-STEP 1.1] 텍스트 크기: {len(raw_text)} bytes")

    # Step 1: 요약 섹션 파싱 (가장 먼저!)
    logger.info("🔍 [R-STEP 2] parse_summary_section 호출 시작")
    summary = parse_summary_section(raw_text)
    logger.info(f"🔍 [R-STEP 2] parse_summary_section 완료 ({time.time() - start_time:.2f}초)")

    # Step 2: 소유자 추출 (요약 우선, fallback으로 전체 문서)
    logger.info("🔍 [R-STEP 3] 소유자 추출 시작")
    owner_name = summary.owner_name if summary.has_summary else extract_owner_name(raw_text)
    logger.info(f"🔍 [R-STEP 3] 소유자 추출 완료: {owner_name} ({time.time() - start_time:.2f}초)")

    # Step 3: 각 항목 추출 (요약 정보 전달) - 개별 호출로 분리하여 디버깅
    logger.info("🔍 [R-STEP 4] extract_property_address 호출 시작")
    property_address = extract_property_address(raw_text)
    logger.info(f"🔍 [R-STEP 4] extract_property_address 완료 ({time.time() - start_time:.2f}초)")

    logger.info("🔍 [R-STEP 5] extract_building_type 호출 시작")
    building_type = extract_building_type(raw_text)
    logger.info(f"🔍 [R-STEP 5] extract_building_type 완료 ({time.time() - start_time:.2f}초)")

    logger.info("🔍 [R-STEP 6] extract_exclusive_area 호출 시작")
    area_m2 = extract_exclusive_area(raw_text)
    logger.info(f"🔍 [R-STEP 6] extract_exclusive_area 완료 ({time.time() - start_time:.2f}초)")

    logger.info("🔍 [R-STEP 7] extract_seizures 호출 시작")
    seizures = extract_seizures(raw_text, summary)
    logger.info(f"🔍 [R-STEP 7] extract_seizures 완료: {len(seizures)}건 ({time.time() - start_time:.2f}초)")

    logger.info("🔍 [R-STEP 8] extract_mortgages 호출 시작")
    mortgages = extract_mortgages(raw_text, summary)
    logger.info(f"🔍 [R-STEP 8] extract_mortgages 완료: {len(mortgages)}건 ({time.time() - start_time:.2f}초)")

    logger.info("🔍 [R-STEP 9] extract_pledges 호출 시작")
    pledges = extract_pledges(raw_text)
    logger.info(f"🔍 [R-STEP 9] extract_pledges 완료: {len(pledges)}건 ({time.time() - start_time:.2f}초)")

    logger.info("🔍 [R-STEP 10] extract_lease_rights 호출 시작")
    lease_rights = extract_lease_rights(raw_text)
    logger.info(f"🔍 [R-STEP 10] extract_lease_rights 완료: {len(lease_rights)}건 ({time.time() - start_time:.2f}초)")

    logger.info("🔍 [R-STEP 11] RegistryDocument 생성 시작")
    registry = RegistryDocument(
        property_address=property_address,
        building_type=building_type,
        area_m2=area_m2,
        owner=OwnerInfo(name=owner_name),
        seizures=seizures,
        mortgages=mortgages,
        pledges=pledges,
        lease_rights=lease_rights,
        raw_text=raw_text
    )
    logger.info(f"🔍 [R-STEP 12] RegistryDocument 생성 완료 - 총 소요시간: {time.time() - start_time:.2f}초")

    return registry


# ===========================
# Gemini Vision OCR (이미지 PDF용)
# ===========================
async def ocr_with_gemini_vision(pdf_path: str) -> str:
    """
    이미지 기반 PDF를 Gemini Vision으로 OCR

    Returns:
        extracted_text: OCR로 추출된 텍스트
    """
    import google.generativeai as genai
    import os
    from PIL import Image

    # Gemini API 키 설정
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-1.5-flash')

    # PDF → 이미지 변환 (첫 페이지만 or 전체)
    doc = fitz.open(pdf_path)  # type: ignore
    texts = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        # PDF 페이지를 이미지로 렌더링
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")

        # PIL Image로 변환
        from io import BytesIO
        img = Image.open(BytesIO(img_bytes))

        # Gemini Vision으로 OCR
        prompt = """이 등기부등본 이미지에서 모든 텍스트를 정확히 추출하라.

출력 형식:
- 원본 그대로 추출 (줄바꿈 포함)
- 표 형식은 그대로 유지
- 숫자, 날짜, 이름 등 정확히 추출"""

        response = model.generate_content([prompt, img])
        texts.append(response.text)

    doc.close()

    extracted_text = "\n\n".join(texts)
    logger.info(f"Gemini OCR 완료: {len(extracted_text)}자")

    return extracted_text


# ===========================
# 구버전 LLM 구조화 (사용 금지!)
# ===========================
def structure_registry_with_llm(raw_text: str) -> RegistryDocument:
    """
    LLM으로 등기부 텍스트를 구조화

    - 프롬프트: 등기부 전문 지식 주입
    - 출력: JSON 스키마 강제 (Pydantic)
    """
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.0,
        model_kwargs={"response_format": {"type": "json_object"}}
    )

    system_prompt = """너는 등기부등본 분석 전문가이다.

주어진 등기부 텍스트에서 다음 정보를 추출하라:

1. **표제부**: 소재지번, 건물 종류, 전용면적
2. **갑구 (소유권)**: 소유자 이름, 지분 비율, 등기일
3. **을구 (권리관계)**:
   - 근저당권: 채권자(은행), 채권최고액, 채무자, 설정일
   - 압류/가압류: **type** 필수 ("압류" 또는 "가압류"), 채권자, 채권액, 접수일
4. **발급일**: 등기부 발급일

**중요**:
- 금액은 "만원" 단위로 변환 (예: 500,000,000원 → 50000)
- 날짜는 YYYY-MM-DD 형식
- 정보가 없으면 null 반환
- **seizures의 type 필드는 반드시 "압류" 또는 "가압류"로 명시**

**출력 형식** (JSON):
```json
{
  "property_address": "서울특별시 강남구 ...",
  "property_type": "아파트",
  "area_m2": 84.5,
  "owners": [
    {"name": "홍길동", "share_ratio": "1/1", "registration_date": "2020-01-15"}
  ],
  "mortgages": [
    {"creditor": "국민은행", "amount": 50000, "debtor": "홍길동", "registration_date": "2020-01-20"}
  ],
  "seizures": [
    {"type": "압류", "creditor": "국세청", "amount": 10000, "registration_date": "2020-01-25"}
  ],
  "issue_date": "2025-01-28"
}
```
"""

    user_prompt = f"""다음 등기부등본을 분석하라:

{raw_text[:4000]}

위 JSON 형식으로 출력하라."""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]

    try:
        response = llm.invoke(messages)

        # JSON 파싱
        import json
        content = response.content if response.content else "{}"
        data = json.loads(content)

        # Pydantic 모델로 변환
        registry = RegistryDocument(**data)
        registry.raw_text = raw_text  # 원본 보존

        logger.info(f"등기부 구조화 완료: {'1명' if registry.owner else '0명'} 소유자, {len(registry.mortgages)}건 근저당")
        return registry

    except Exception as e:
        logger.error(f"LLM 구조화 실패: {e}")
        # 실패 시 빈 문서 반환 (raw_text만 포함)
        return RegistryDocument(raw_text=raw_text)


# ===========================
# 메인 파싱 함수 (리팩토링 완료)
# ===========================
async def parse_registry_pdf(
    pdf_path: str,
    case_id: Optional[str] = None,
    user_id: Optional[str] = None
) -> RegistryDocument:
    """
    등기부 PDF 파싱 및 구조화

    전략:
    1. 텍스트 PDF → 정규식 파서 (LLM 없음, 비용 0, hallucination 없음)
    2. 이미지 PDF → Gemini Vision OCR → 정규식 파서

    Args:
        pdf_path: PDF 파일 경로
        case_id: 케이스 UUID (선택, 감사 로그용)
        user_id: 사용자 UUID (선택, 감사 로그용)

    Returns:
        RegistryDocument: 파싱된 등기부 데이터

    Raises:
        Exception: 파싱 실패 시 (감사 로그 자동 기록)
    """
    logger.info(f"📄 [PDF 파싱 시작] 파일: {pdf_path}")

    try:
        # Step 1: PDF 타입 감지
        logger.info("🔍 [Step 1/3] PDF 타입 감지 중...")
        is_text_pdf, raw_text = is_text_extractable_pdf(pdf_path, min_chars=500)

        logger.info(f"✅ [PDF 타입] {'텍스트 PDF' if is_text_pdf else '이미지 PDF'} (추출된 텍스트: {len(raw_text)}자)")

        # Step 2: 이미지 PDF면 Gemini Vision OCR
        if not is_text_pdf:
            logger.info("🖼️ [Step 2/3] 이미지 PDF 감지 → Gemini Vision OCR 시작")

            try:
                raw_text = await ocr_with_gemini_vision(pdf_path)
                logger.info(f"✅ [OCR 완료] 추출된 텍스트: {len(raw_text)}자")

            except Exception as ocr_error:
                # OCR 실패 감사 로그
                log_parsing_error(
                    case_id=case_id or "unknown",
                    error_message=f"Gemini Vision OCR 실패: {str(ocr_error)}",
                    error_type=EventType.OCR_FAILED,
                    user_id=user_id,
                    metadata={"pdf_path": pdf_path, "error": str(ocr_error)}
                )
                raise

            # OCR 결과 검증
            if not raw_text or len(raw_text) < 100:
                error_msg = f"OCR 텍스트가 너무 짧음: {len(raw_text)}자 (최소 100자 필요)"
                logger.error(f"❌ [OCR 실패] {error_msg}")

                # 감사 로그 기록
                log_parsing_error(
                    case_id=case_id or "unknown",
                    error_message=error_msg,
                    error_type=EventType.PDF_TEXT_EXTRACTION_FAILED,
                    user_id=user_id,
                    metadata={"text_length": len(raw_text), "min_required": 100}
                )

                return RegistryDocument(raw_text=raw_text)
        else:
            logger.info("📝 [Step 2/3] 텍스트 PDF - OCR 생략")

        # 원본 텍스트 미리보기 (디버깅용)
        preview = raw_text[:500].replace('\n', ' ')
        logger.info(f"📄 [텍스트 미리보기] {preview}...")

        # Step 3: 정규식 기반 파싱 (LLM 없음!)
        logger.info("🔍 [Step 3/3] 정규식 기반 파싱 시작...")
        registry = parse_with_regex(raw_text)

        # 파싱 결과 상세 로깅
        logger.info(f"✅ [파싱 완료] 주소={registry.property_address or 'N/A'}")
        logger.info(f"   └─ 소유자: {registry.owner.name if registry.owner else 'N/A'}")
        logger.info(f"   └─ 근저당: {len(registry.mortgages)}건 (총 {sum(m.amount or 0 for m in registry.mortgages)}만원)")
        logger.info(f"   └─ 압류/가압류: {len(registry.seizures)}건")
        logger.info(f"   └─ 질권: {len(registry.pledges)}건")
        logger.info(f"   └─ 전세권: {len(registry.lease_rights)}건")

        # 파싱 신뢰도 체크 (핵심 필드 누락 경고)
        missing_fields = []
        if not registry.property_address:
            logger.warning("⚠️ [파싱 경고] 주소 추출 실패")
            missing_fields.append("property_address")
        if not registry.owner:
            logger.warning("⚠️ [파싱 경고] 소유자 정보 추출 실패")
            missing_fields.append("owner")

        # 핵심 필드 누락 시 경고 로그
        if missing_fields:
            log_parsing_warning(
                case_id=case_id or "unknown",
                warning_message=f"핵심 필드 누락: {', '.join(missing_fields)}",
                user_id=user_id,
                metadata={
                    "missing_fields": missing_fields,
                    "text_length": len(raw_text),
                    "mortgage_count": len(registry.mortgages),
                    "seizure_count": len(registry.seizures)
                }
            )

        # 성공 감사 로그
        log_parsing_success(
            case_id=case_id or "unknown",
            message=f"등기부 파싱 완료 (주소: {registry.property_address or 'N/A'})",
            user_id=user_id,
            metadata={
                "pdf_type": "text" if is_text_pdf else "image",
                "text_length": len(raw_text),
                "mortgage_count": len(registry.mortgages),
                "seizure_count": len(registry.seizures),
                "missing_fields": missing_fields
            }
        )

        return registry

    except RegexTimeoutError as e:
        # 정규식 타임아웃 (catastrophic backtracking으로 인한 무한 루프)
        error_msg = f"등기부 파싱 타임아웃: 정규식 처리 시간 초과 (30초)"
        logger.error(f"❌ [파싱 타임아웃] {error_msg}", exc_info=True)

        # 감사 로그 기록
        log_parsing_error(
            case_id=case_id or "unknown",
            error_message=error_msg,
            error_type=EventType.REGISTRY_PARSING_FAILED,
            user_id=user_id,
            metadata={
                "pdf_path": pdf_path,
                "error": str(e),
                "error_type": "RegexTimeoutError",
                "text_length": len(raw_text) if 'raw_text' in locals() else None,
                "suggestion": "문서가 복잡하거나 비정상적인 패턴 포함"
            }
        )

        # 빈 문서 반환 (타임아웃 시에도 서비스 유지)
        return RegistryDocument(raw_text=raw_text if 'raw_text' in locals() else "")

    except Exception as e:
        error_msg = f"등기부 파싱 실패: {str(e)}"
        logger.error(f"❌ [파싱 실패] {error_msg}", exc_info=True)

        # 감사 로그 기록
        log_parsing_error(
            case_id=case_id or "unknown",
            error_message=error_msg,
            error_type=EventType.REGISTRY_PARSING_FAILED,
            user_id=user_id,
            metadata={"pdf_path": pdf_path, "error": str(e), "error_type": type(e).__name__}
        )

        raise


async def parse_registry_from_url(
    file_url: str,
    case_id: Optional[str] = None,
    user_id: Optional[str] = None
) -> RegistryDocument:
    """
    Supabase Storage URL에서 등기부 파싱

    보안 강화:
    - 정규식 패턴 매칭 (버킷 + 경로 검증)
    - 버킷 화이트리스트 (artifacts만 허용)
    - SSRF 방지 (내부 IP 차단)
    - Content-Type 검증 (application/pdf만 허용)

    Args:
        file_url: Supabase Storage URL
        case_id: 케이스 UUID (감사 로그용, 선택)
        user_id: 사용자 UUID (감사 로그용, 선택)
    """
    import tempfile
    import httpx
    from urllib.parse import urlparse, parse_qs
    import socket, ipaddress, os, re
    from core.settings import settings
    from fastapi import HTTPException

    # 1) HTTPS 강제
    parsed = urlparse(file_url)
    if parsed.scheme != "https":
        logger.error(f"❌ [URL 검증 실패] HTTP 프로토콜: {file_url}")
        raise HTTPException(status_code=400, detail="Only HTTPS URLs are allowed")

    # 2) Supabase Storage URL 패턴 매칭 (정규식 + 버킷 화이트리스트)
    if settings.allow_parse_public_supabase_only and settings.supabase_url:
        supabase_host = settings.supabase_url.replace('https://', '').replace('http://', '')

        # 허용된 버킷 (화이트리스트 - settings에서 로드)
        ALLOWED_BUCKETS = settings.storage_bucket_whitelist

        # 정규식 패턴: https://{supabase_host}/storage/v1/object/(public|sign|authenticated)/{bucket}/{path}
        pattern = re.compile(
            rf"^https://{re.escape(supabase_host)}/storage/v1/object/"
            r"(public|sign|authenticated)/(?P<bucket>[a-z0-9-_]+)/(?P<path>.+)$"
        )

        match = pattern.match(file_url)

        if not match:
            # URL 민감 정보 마스킹 (쿼리스트링 제거)
            safe_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            logger.error(f"❌ [URL 검증 실패] 패턴 불일치: {safe_url}")
            logger.error(f"   └─ 허용 패턴: {supabase_host}/storage/v1/object/(public|sign|authenticated)/<bucket>/<path>")
            raise HTTPException(status_code=403, detail="URL pattern not permitted")

        bucket = match.group('bucket')

        if bucket not in ALLOWED_BUCKETS:
            logger.error(f"❌ [버킷 검증 실패] 허용되지 않은 버킷: {bucket}")
            logger.error(f"   └─ 허용 버킷: {', '.join(ALLOWED_BUCKETS)}")
            raise HTTPException(status_code=403, detail=f"Bucket '{bucket}' not allowed")

        logger.info(f"✅ [URL 검증 통과] 버킷={bucket}, 경로={match.group('path')[:50]}...")

    # 3) SSRF 방지 강화: 호스트 IP가 내부망/로컬/메타데이터 주소인지 확인
    try:
        # DNS resolution을 통해 실제 IP 확인
        infos = socket.getaddrinfo(parsed.hostname, 443)
        for family, _, _, _, sockaddr in infos:
            ip = ipaddress.ip_address(sockaddr[0])

            # 내부망 IP 차단 (Private, Loopback, Link-Local, Multicast, Reserved)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
                logger.error(f"❌ [SSRF 방지] 내부 IP로 리졸브됨: {sockaddr[0]}")
                raise HTTPException(status_code=403, detail="URL resolves to a private or disallowed IP")

        logger.info(f"✅ [SSRF 검증 통과] 호스트={parsed.hostname}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ [SSRF 검증 실패] DNS 리졸브 오류: {e}")
        raise HTTPException(status_code=403, detail=f"Failed to resolve host for security checks: {e}")

    # 4) HEAD 요청으로 Content-Type 선검증 (application/pdf만 허용)
    limits = httpx.Limits(max_connections=5, max_keepalive_connections=5)
    timeout = httpx.Timeout(10.0, connect=5.0, read=10.0)

    async with httpx.AsyncClient(limits=limits, timeout=timeout, follow_redirects=False) as client:
        try:
            # HEAD 요청으로 메타데이터 확인
            head_resp = await client.head(file_url)
            head_resp.raise_for_status()

            content_type = head_resp.headers.get("Content-Type", "")
            content_length = head_resp.headers.get("Content-Length", "0")

            # Content-Type 검증
            if "application/pdf" not in content_type.lower():
                logger.error(f"❌ [Content-Type 검증 실패] {content_type}")
                raise HTTPException(status_code=422, detail="File must be application/pdf")

            # Content-Length 검증
            max_bytes = settings.parse_max_download_mb * 1024 * 1024
            try:
                file_size = int(content_length)
                if file_size > max_bytes:
                    logger.error(f"❌ [파일 크기 초과] {file_size} bytes > {max_bytes} bytes")
                    raise HTTPException(status_code=422, detail=f"File size exceeds {settings.parse_max_download_mb}MB limit")

                logger.info(f"✅ [HEAD 검증 통과] Content-Type={content_type}, Size={file_size} bytes")

            except ValueError:
                # Content-Length 파싱 실패 시 경고만 (스트리밍에서 재검증)
                logger.warning(f"⚠️ [HEAD 응답] Content-Length 파싱 실패: {content_length}")

        except HTTPException:
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ [HEAD 요청 실패] HTTP {e.response.status_code}")
            # HEAD 실패 시에도 GET으로 진행 (일부 서버는 HEAD를 지원하지 않음)
            logger.warning("⚠️ HEAD 요청 실패, GET으로 진행합니다")

        # 5) 제한된 스트리밍 다운로드 (크기 제한, 리다이렉트 금지)
        async with client.stream("GET", file_url, headers={"Accept": "application/pdf"}) as resp:
            resp.raise_for_status()

            # Content-Type 재검증 (GET 응답에서)
            content_type = resp.headers.get("Content-Type", "")
            if "application/pdf" not in content_type.lower():
                logger.error(f"❌ [GET Content-Type 검증 실패] {content_type}")
                raise HTTPException(status_code=422, detail="File must be application/pdf")

            total = 0
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp_path = tmp.name
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    total += len(chunk)
                    if total > max_bytes:
                        tmp.close()
                        os.unlink(tmp_path)
                        logger.error(f"❌ [다운로드 크기 초과] {total} bytes")
                        raise HTTPException(status_code=422, detail="Downloaded file exceeds size limit")
                    tmp.write(chunk)

            logger.info(f"✅ [다운로드 완료] {total} bytes")

        # 6) 파싱 (감사 로그 컨텍스트 전달)
        registry = await parse_registry_pdf(tmp_path, case_id=case_id, user_id=user_id)

        # 7) 임시 파일 삭제
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

        return registry


# ===========================
# 예시 사용법 (테스트용)
# ===========================
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # 예시: 로컬 PDF 파싱
    # registry = parse_registry_pdf("/path/to/registry.pdf")
    # print(f"주소: {registry.property_address}")
    # print(f"소유자: {registry.owner}")
    # print(f"근저당: {registry.mortgages}")
    pass

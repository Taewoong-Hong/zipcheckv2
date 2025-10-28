"""
등기부등본 파싱 및 구조화

전략:
1. 텍스트 PDF: PyMuPDF → 정규식 파서 (LLM 없음, 비용 0)
2. 이미지 PDF: Gemini Vision OCR → 정규식 파서 (LLM은 OCR만)

LLM으로 구조화 절대 금지! (hallucination + 불필요한 비용)
"""
import logging
import re
from typing import Optional, List
from pydantic import BaseModel
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


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

    def get_masked_debtor(self) -> Optional[str]:
        """마스킹된 채무자 반환 (개인만)"""
        return mask_personal_name(self.debtor)


class SeizureInfo(BaseModel):
    """압류/가압류/가처분 정보 (갑구)"""
    type: str  # "압류" | "가압류" | "가처분"
    creditor: Optional[str] = None  # 채권자
    amount: Optional[int] = None  # 채권액 (만원)
    registration_date: Optional[str] = None  # 접수일
    description: Optional[str] = None  # 추가 설명


class PledgeInfo(BaseModel):
    """질권 정보 (을구)"""
    creditor: Optional[str] = None  # 질권자
    amount: Optional[int] = None  # 채권최고액 (만원)
    registration_date: Optional[str] = None  # 설정일


class LeaseRightInfo(BaseModel):
    """전세권 정보 (을구)"""
    lessee: Optional[str] = None  # 전세권자
    amount: Optional[int] = None  # 전세금 (만원)
    period_start: Optional[str] = None  # 존속기간 시작
    period_end: Optional[str] = None  # 존속기간 종료
    registration_date: Optional[str] = None  # 설정일


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
                    "creditor": m.creditor,  # 기업명은 그대로
                    "amount": m.amount,
                    "debtor": m.get_masked_debtor(),  # 개인만 마스킹
                    "registration_date": m.registration_date,
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
                }
                for s in self.seizures
            ],
            "pledges": [
                {
                    "creditor": p.creditor,
                    "amount": p.amount,
                    "registration_date": p.registration_date,
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
        doc = fitz.open(pdf_path)
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


def extract_owner_name(text: str) -> Optional[str]:
    """소유자 이름 추출 (갑구)"""
    # 패턴: "소유자" 다음에 나오는 이름
    pattern = r'소유자\s*[:：]?\s*([가-힣]+)'
    match = re.search(pattern, text)
    if match:
        return match.group(1).strip()
    return None


def extract_mortgages(text: str) -> List[MortgageInfo]:
    """근저당권 추출 (을구)"""
    mortgages = []

    # 패턴: 채권최고액, 채권자, 채무자 추출
    # 예: "채권최고액 금 1,172,400,000원"
    amount_pattern = r'채권최고액\s*금?\s*([\d,]+)\s*원'
    creditor_pattern = r'채권자\s*[:：]?\s*([^\n]+?)(?:\s|$)'
    debtor_pattern = r'채무자\s*[:：]?\s*([가-힣]+)'

    # 모든 근저당권 찾기
    for amount_match in re.finditer(amount_pattern, text):
        amount_str = amount_match.group(1).replace(',', '')
        amount_won = int(amount_str)
        amount_man = amount_won // 10000  # 만원 단위

        # 근처에서 채권자/채무자 찾기 (앞뒤 200자 범위)
        start = max(0, amount_match.start() - 200)
        end = min(len(text), amount_match.end() + 200)
        context = text[start:end]

        creditor = None
        creditor_match = re.search(creditor_pattern, context)
        if creditor_match:
            creditor = creditor_match.group(1).strip()

        debtor = None
        debtor_match = re.search(debtor_pattern, context)
        if debtor_match:
            debtor = debtor_match.group(1).strip()

        mortgages.append(MortgageInfo(
            creditor=creditor,
            amount=amount_man,
            debtor=debtor
        ))

    return mortgages


def extract_seizures(text: str) -> List[SeizureInfo]:
    """압류/가압류/가처분 추출 (갑구)"""
    seizures = []

    # 패턴: "압류", "가압류", "가처분", "임의경매" 등
    seizure_keywords = {
        '가압류': '가압류',
        '가처분': '가처분',
        '임의경매': '압류',
        '강제경매': '압류',
        '압류': '압류',
    }

    for keyword, seizure_type in seizure_keywords.items():
        # 키워드가 있는지 확인
        pattern_search = f'{keyword}'
        if pattern_search not in text:
            continue

        # 근처에서 채권자 찾기
        pattern = f'{keyword}[^가-힣]{{0,50}}([가-힣]+(?:캐피탈|은행|금융|신협|저축|증권|국세청|시청|구청)?)'
        match = re.search(pattern, text)
        creditor = match.group(1).strip() if match else None

        # 금액 찾기 (있을 경우)
        amount = None
        amount_pattern = f'{keyword}[^0-9]{{0,100}}금?\s*([\d,]+)\s*원'
        amount_match = re.search(amount_pattern, text)
        if amount_match:
            amount_str = amount_match.group(1).replace(',', '')
            amount = int(amount_str) // 10000  # 만원 단위

        seizures.append(SeizureInfo(
            type=seizure_type,
            creditor=creditor,
            amount=amount,
            description=keyword  # 원본 키워드 저장
        ))

    return seizures


def extract_pledges(text: str) -> List[PledgeInfo]:
    """질권 추출 (을구)"""
    pledges = []

    # 패턴: "질권" + 채권최고액
    if '질권' not in text:
        return pledges

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

        pledges.append(PledgeInfo(
            creditor=creditor,
            amount=amount_man,
        ))

    return pledges


def extract_lease_rights(text: str) -> List[LeaseRightInfo]:
    """전세권 추출 (을구)"""
    lease_rights = []

    # 패턴: "전세권" + 전세금
    if '전세권' not in text:
        return lease_rights

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

        lease_rights.append(LeaseRightInfo(
            lessee=lessee,
            amount=amount_man,
            period_start=period_start,
            period_end=period_end,
        ))

    return lease_rights


def parse_with_regex(raw_text: str) -> RegistryDocument:
    """정규식 기반 등기부 파싱 (LLM 없음)"""
    return RegistryDocument(
        property_address=extract_property_address(raw_text),
        owner=OwnerInfo(name=extract_owner_name(raw_text)),
        # 갑구
        seizures=extract_seizures(raw_text),
        # 을구
        mortgages=extract_mortgages(raw_text),
        pledges=extract_pledges(raw_text),
        lease_rights=extract_lease_rights(raw_text),
        raw_text=raw_text
    )


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
    doc = fitz.open(pdf_path)
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
        data = json.loads(response.content)

        # Pydantic 모델로 변환
        registry = RegistryDocument(**data)
        registry.raw_text = raw_text  # 원본 보존

        logger.info(f"등기부 구조화 완료: {len(registry.owners)}명 소유자, {len(registry.mortgages)}건 근저당")
        return registry

    except Exception as e:
        logger.error(f"LLM 구조화 실패: {e}")
        # 실패 시 빈 문서 반환 (raw_text만 포함)
        return RegistryDocument(raw_text=raw_text)


# ===========================
# 메인 파싱 함수 (리팩토링 완료)
# ===========================
def parse_registry_pdf(pdf_path: str) -> RegistryDocument:
    """
    등기부 PDF 파싱 및 구조화

    전략:
    1. 텍스트 PDF → 정규식 파서 (LLM 없음, 비용 0, hallucination 없음)
    2. 이미지 PDF → Gemini Vision OCR → 정규식 파서
    """
    logger.info(f"등기부 파싱 시작: {pdf_path}")

    # Step 1: PDF 타입 감지
    is_text_pdf, raw_text = is_text_extractable_pdf(pdf_path, min_chars=500)

    # Step 2: 이미지 PDF면 Gemini Vision OCR
    if not is_text_pdf:
        logger.info("이미지 PDF 감지 → Gemini Vision OCR 시작")
        import asyncio
        raw_text = asyncio.run(ocr_with_gemini_vision(pdf_path))

        if not raw_text or len(raw_text) < 100:
            logger.error("OCR 실패 또는 텍스트 없음")
            return RegistryDocument(raw_text=raw_text)

    # Step 3: 정규식 기반 파싱 (LLM 없음!)
    registry = parse_with_regex(raw_text)

    logger.info(f"파싱 완료: 주소={registry.property_address}, 근저당={len(registry.mortgages)}건")
    return registry


async def parse_registry_from_url(file_url: str) -> RegistryDocument:
    """
    Supabase Storage URL에서 등기부 파싱

    TODO: URL에서 다운로드 후 파싱
    """
    # 임시로 파일 경로로 처리 (향후 httpx로 다운로드)
    import tempfile
    import httpx

    async with httpx.AsyncClient() as client:
        response = await client.get(file_url)
        response.raise_for_status()

        # 임시 파일에 저장
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        # 파싱
        registry = parse_registry_pdf(tmp_path)

        # 임시 파일 삭제
        import os
        os.unlink(tmp_path)

        return registry


# ===========================
# 예시 사용법 (테스트용)
# ===========================
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # 예시: 로컬 PDF 파싱
    # registry = parse_registry_pdf("/path/to/registry.pdf")
    # print(f"주소: {registry.property_address}")
    # print(f"소유자: {registry.owners}")
    # print(f"근저당: {registry.mortgages}")
    pass

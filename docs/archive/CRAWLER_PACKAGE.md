# 🕷️ 부동산 크롤러 패키지 (zipcheck-crawler)

> **⚠️ 중요**: 크롤러는 **별도 Git 레포지토리**로 분리되어 운영됩니다.

## 📦 레포지토리 정보

- **GitHub**: https://github.com/Taewoong-Hong/zipcheck_rawl
- **패키지명**: `zipcheck-crawler`
- **버전**: 1.0.0

---

## 🎯 개요

좌표 기반 부동산 매물 정보를 수집하고 자체 DB에 저장하는 Python 패키지입니다.

### 🔒 보안 설계

- **외부 출처 완전 숨김**: 크롤링 소스를 식별할 수 있는 모든 정보 제거
- **프론트엔드 노출 금지**: `external_id`, `region_code` 등 내부 참조용 필드 자동 필터링
- **데이터 정규화**: 외부 API 응답을 집체크 표준 형식으로 변환

---

## 📥 설치 방법

### 메인 프로젝트 (zipcheckv2)에서 사용

```bash
cd services/ai

# requirements.txt에 추가됨
pip install -r requirements.txt
```

**requirements.txt**:
```
# 크롤러 패키지 (별도 레포지토리)
zipcheck-crawler @ git+https://github.com/Taewoong-Hong/zipcheck_rawl.git@main
```

### 로컬 개발 모드

```bash
# 크롤러 레포 클론
git clone https://github.com/Taewoong-Hong/zipcheck_rawl.git
cd zipcheck-crawler

# Editable 모드 설치 (개발 중 실시간 반영)
pip install -e .

# 메인 프로젝트에서 바로 사용 가능
cd C:\dev\zipcheckv2\services\ai
python -c "from zipcheck_crawler import PropertyCrawler; print('OK')"
```

---

## 🚀 사용법

### 기본 사용

```python
from zipcheck_crawler import PropertyCrawler, DataNormalizer, RealEstateDB

# 크롤러 초기화
crawler = PropertyCrawler()

# 강남역 반경 5km 내 매물 크롤링
result = await crawler.crawl_area(
    lat=37.498095,
    lon=127.027610,
    radius_km=5.0,
    trade_types=["A1", "B1"]  # 매매, 전세
)

# 데이터 정규화 (외부 출처 제거)
for marker in result["data"]["매매"]["body"]:
    normalized = DataNormalizer.normalize_complex(marker)
    # external_id, region_code 등 내부용 필드 포함

# 프론트엔드 전송 시 출처 정보 제거
clean_data = DataNormalizer.anonymize_for_frontend(normalized)
# external_id, region_code 완전 제거됨

# DB 저장
db = RealEstateDB()
await db.upsert_complex(normalized)
```

---

## 📊 데이터 구조

### 거래 유형 매핑

| 외부 코드 | 표준 코드 | 설명 |
|----------|----------|------|
| A1 | SALE | 매매 |
| B1 | JEONSE | 전세 |
| B2 | MONTHLY | 월세 |

### 가격 단위

- **DB 저장**: 만원 단위 (예: 120000 = 12억)
- **프론트엔드**: 원하는 단위로 변환

---

## 🔐 보안 정책

### 출처 정보 노출 금지

**프론트엔드에 절대 노출하면 안 되는 필드**:
- `external_id` (외부 단지 코드)
- `external_article_id` (외부 매물 ID)
- `region_code` (외부 지역 코드)
- `crawled_at` (크롤링 시각)

**자동 제거 메커니즘**:
```python
# DB에서 조회 후 프론트엔드 전송 전 필수 처리
clean_data = DataNormalizer.anonymize_for_frontend(raw_data)
```

### 데이터 변환 흐름

```
외부 API 원본
    ↓ PropertyCrawler.crawl_area()
크롤링 결과 (raw)
    ↓ DataNormalizer.normalize_*()
자체 DB 형식 (internal 필드 포함)
    ↓ RealEstateDB.upsert_*()
Supabase 저장
    ↓ DataNormalizer.anonymize_for_frontend()
프론트엔드 전송 (출처 완전 제거) ✅
```

---

## 🏗️ 패키지 구조

```
zipcheck_crawler/
├─ __init__.py                   # 패키지 엔트리포인트
├─ crawler/
│  ├─ __init__.py
│  ├─ property_crawler.py        # 크롤링 엔진
│  ├─ data_normalizer.py         # 데이터 정규화 & 출처 제거
│  └─ db_manager.py              # Supabase 연동
└─ utils/
   ├─ __init__.py
   └─ korea_regions.py           # 전국 지역 좌표 (150+ 지역)
```

---

## 🔧 환경변수 설정

```bash
# .env 파일
DATABASE_URL=postgresql://...
SUPABASE_SERVICE_KEY=your_service_key_here
```

---

## 📝 주의사항

1. **크롤링 빈도 제한**: 외부 서버 부하 방지를 위해 적절한 간격 유지
2. **출처 노출 금지**: 프론트엔드에서 절대 외부 출처 노출 금지
3. **데이터 정확성**: 크롤링 데이터는 참고용이며, 실제 거래는 확인 필요
4. **법적 책임**: 크롤링 데이터 사용 시 법적 책임은 사용자에게 있음

---

## ⚠️ 법적 고지

- 본 크롤러는 교육/연구 목적으로만 사용
- 상업적 사용 시 법적 이슈 발생 가능
- 크롤링 데이터의 정확성을 보장하지 않음
- 사용자는 관련 법규를 준수할 책임이 있음

---

## 🔗 관련 문서

- [크롤러 GitHub 레포](https://github.com/Taewoong-Hong/zipcheck_rawl)
- [메인 프로젝트 가이드](CLAUDE.md)
- [DB 스키마](db/schema_realestate.sql)

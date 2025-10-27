# 네이버 부동산 크롤링 시스템

좌표 기반 부동산 매물 크롤링 및 자체 DB 저장 시스템

## 🎯 주요 기능

1. **전국 지역구 좌표 DB**: 전국 주요 시/군/구 좌표 (150+ 지역)
2. **네이버 부동산 크롤링**: 좌표 기반 아파트/오피스텔 매물 수집
3. **데이터 정규화**: 외부 출처 제거 및 표준화
4. **Supabase 저장**: 자체 DB에 저장 (출처 노출 금지)
5. **FastAPI 엔드포인트**: 크롤링 및 검색 API 제공

## 📦 설치

```bash
cd services/ai

# 의존성 설치
pip install httpx supabase

# 환경변수 설정
# .env 파일에 추가:
# DATABASE_URL=postgresql://...  # Supabase Postgres URL
# SUPABASE_SERVICE_KEY=...        # Service role key
```

## 🗄️ 데이터베이스 스키마 생성

```bash
# Supabase SQL Editor에서 실행
psql < ../../db/schema_realestate.sql
```

## 🚀 사용법

### 1. Python 직접 사용

```python
from crawler.naver_land_crawler import NaverLandCrawler
from crawler.data_normalizer import DataNormalizer
from crawler.db_manager import RealEstateDB

# 크롤러 초기화
crawler = NaverLandCrawler()
db = RealEstateDB()

# 강남역 반경 5km 내 매물 크롤링
result = await crawler.crawl_area(
    lat=37.498095,
    lon=127.027610,
    radius_km=5.0,
    trade_types=["A1", "B1"]  # 매매, 전세
)

# 데이터 정규화 및 저장
# ... (자세한 코드는 db_manager.py 참고)
```

### 2. FastAPI 엔드포인트

#### 전국 지역 조회
```bash
GET /realestate/regions

응답:
{
  "total": 150,
  "regions": [
    {
      "sido": "서울특별시",
      "sigungu": "강남구",
      "lat": 37.5172,
      "lon": 127.0473
    },
    ...
  ]
}
```

#### 크롤링 요청 (백그라운드 작업)
```bash
POST /realestate/crawl

요청:
{
  "lat": 37.498095,
  "lon": 127.027610,
  "radius_km": 5.0,
  "trade_types": ["A1", "B1"]
}

응답:
{
  "message": "크롤링이 시작되었습니다",
  "center": {"lat": 37.498095, "lon": 127.027610},
  "radius_km": 5.0,
  "trade_types": ["A1", "B1"]
}
```

#### 매물 검색 (자체 DB에서)
```bash
POST /realestate/search

요청:
{
  "lat": 37.498095,
  "lon": 127.027610,
  "radius_km": 5.0,
  "trade_type": "SALE",  # 매매만 (선택사항)
  "limit": 100
}

응답:
{
  "total": 45,
  "results": [
    {
      "complex": {
        "id": "uuid-...",
        "name": "래미안강남힐즈",
        "address": "서울특별시 강남구 역삼동 123",
        "latitude": 37.498,
        "longitude": 127.028,
        "total_households": 2000,
        "completion_date": "2015-01-15"
        // ⚠️ external_id, crawled_at 등 출처 정보 제외됨
      },
      "properties": [
        {
          "id": "uuid-...",
          "trade_type": "SALE",
          "price": 120000,  # 만원 단위 (12억)
          "floor": 15,
          "exclusive_area": 84.99,
          "supply_area": 114.23
          // ⚠️ external_article_id 등 출처 정보 제외됨
        },
        ...
      ],
      "property_count": 23
    },
    ...
  ]
}
```

#### 단지 상세 조회
```bash
POST /realestate/complex/detail

요청:
{
  "complex_id": "uuid-...",
  "trade_type": "JEONSE"  # 전세만 (선택사항)
}

응답:
{
  "complex": { ... },
  "properties": [ ... ],
  "property_count": 15
}
```

## 🔐 보안 정책

### 출처 정보 노출 금지

**프론트엔드에 절대 노출하면 안 되는 필드**:
- `external_id` (네이버 단지 코드)
- `external_article_id` (네이버 매물 ID)
- `cortar_no` (네이버 지역 코드)
- `crawled_at` (크롤링 시각)

**자동 제거 메커니즘**:
- `DataNormalizer.anonymize_for_frontend()` 함수가 자동 제거
- DB 조회 시 응답에서 자동 필터링
- 프론트엔드는 출처를 전혀 알 수 없음

### 데이터 변환 흐름

```
네이버 API 원본
    ↓
DataNormalizer (출처 제거 + 표준화)
    ↓
Supabase DB (internal 필드 포함)
    ↓
FastAPI (anonymize_for_frontend)
    ↓
프론트엔드 (완전히 익명화된 데이터)
```

## 📊 데이터 구조

### 거래 유형 매핑

| 네이버 코드 | 집체크 표준 | 설명 |
|------------|------------|------|
| A1 | SALE | 매매 |
| B1 | JEONSE | 전세 |
| B2 | MONTHLY | 월세 |

### 가격 단위

- **DB 저장**: 만원 단위 (예: 120000 = 12억)
- **프론트엔드**: 원하는 단위로 변환 (억, 만원 등)

## 🎨 프론트엔드 표시 예시

```typescript
// ❌ 잘못된 예시 (출처 노출)
<div>
  데이터 출처: 네이버 부동산
  단지 코드: {complex.external_id}
</div>

// ✅ 올바른 예시 (출처 숨김)
<div>
  {complex.name}
  {complex.address}
  총 {complex.total_households}세대
</div>
```

## 🧪 테스트

```bash
# 크롤러 단독 테스트
python crawler/naver_land_crawler.py

# 데이터 정규화 테스트
python crawler/data_normalizer.py

# 지역 검색 테스트
python crawler/korea_regions.py

# DB 저장 테스트
python crawler/db_manager.py
```

## 📝 주의사항

1. **크롤링 빈도 제한**: 네이버 서버 부하 방지를 위해 적절한 간격 유지
2. **출처 노출 금지**: 프론트엔드에서 절대 네이버 출처 노출 금지
3. **데이터 정확성**: 크롤링 데이터는 참고용이며, 실제 거래는 확인 필요
4. **법적 책임**: 크롤링 데이터 사용 시 법적 책임은 사용자에게 있음

## 🚨 법적 고지

- 본 크롤러는 교육/연구 목적으로만 사용
- 상업적 사용 시 네이버와의 저작권 이슈 발생 가능
- 크롤링 데이터의 정확성을 보장하지 않음
- 사용자는 관련 법규를 준수할 책임이 있음

## 🔗 관련 문서

- [DB 스키마](../../db/schema_realestate.sql)
- [FastAPI 엔드포인트](../routes/realestate.py)
- [전체 프로젝트 가이드](../../CLAUDE.md)

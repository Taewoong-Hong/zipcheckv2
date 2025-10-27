-- ==============================
-- 집체크 부동산 데이터 스키마
-- ==============================

-- 전국 지역구 좌표 테이블
CREATE TABLE IF NOT EXISTS v2_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sido VARCHAR(50) NOT NULL,          -- 시/도 (예: 서울특별시)
  sigungu VARCHAR(50),                 -- 시/군/구 (예: 강남구)
  dong VARCHAR(50),                    -- 읍/면/동 (예: 역삼동)
  cortar_no VARCHAR(20) UNIQUE,        -- 네이버 지역 코드 (내부용)
  center_lat DECIMAL(10, 7) NOT NULL,  -- 중심 위도
  center_lon DECIMAL(11, 7) NOT NULL,  -- 중심 경도
  bounds JSONB,                        -- 경계 좌표 (left_lon, right_lon, top_lat, bottom_lat)
  level INT DEFAULT 1,                 -- 1: 시/도, 2: 시/군/구, 3: 읍/면/동
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 공간 인덱스
CREATE INDEX IF NOT EXISTS idx_regions_location ON v2_regions USING GIST (
  ll_to_earth(center_lat, center_lon)
);
CREATE INDEX IF NOT EXISTS idx_regions_sido ON v2_regions(sido);
CREATE INDEX IF NOT EXISTS idx_regions_sigungu ON v2_regions(sigungu);


-- 아파트 단지 정보 테이블
CREATE TABLE IF NOT EXISTS v2_complexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES v2_regions(id) ON DELETE SET NULL,

  -- 기본 정보
  name VARCHAR(200) NOT NULL,          -- 단지명
  address VARCHAR(500) NOT NULL,       -- 주소
  road_address VARCHAR(500),           -- 도로명 주소

  -- 좌표
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(11, 7) NOT NULL,

  -- 단지 정보
  total_households INT,                -- 총 세대수
  completion_date DATE,                -- 준공일
  building_count INT,                  -- 동 수
  max_floor INT,                       -- 최고층
  parking_count INT,                   -- 주차대수

  -- 면적 정보
  area_types JSONB,                    -- 면적 타입별 정보 [{type: "59A", area: 59.98, supply_area: 84.99}]

  -- 관리비 정보
  avg_maintenance_fee INT,             -- 평균 관리비

  -- 외부 참조 (내부 용도)
  external_id VARCHAR(50) UNIQUE,      -- 네이버 단지 코드 (노출 안 함)

  -- 메타
  crawled_at TIMESTAMPTZ,              -- 마지막 크롤링 시각
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 공간 인덱스
CREATE INDEX IF NOT EXISTS idx_complexes_location ON v2_complexes USING GIST (
  ll_to_earth(latitude, longitude)
);
CREATE INDEX IF NOT EXISTS idx_complexes_region ON v2_complexes(region_id);
CREATE INDEX IF NOT EXISTS idx_complexes_name ON v2_complexes(name);


-- 매물 정보 테이블
CREATE TABLE IF NOT EXISTS v2_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complex_id UUID REFERENCES v2_complexes(id) ON DELETE CASCADE,

  -- 거래 정보
  trade_type VARCHAR(20) NOT NULL,     -- SALE: 매매, JEONSE: 전세, MONTHLY: 월세
  price BIGINT,                        -- 매매가/전세가 (만원 단위)
  deposit BIGINT,                      -- 보증금 (만원, 월세용)
  monthly_rent INT,                    -- 월세 (만원)

  -- 매물 상세
  floor INT,                           -- 층
  area_type VARCHAR(20),               -- 면적 타입 (예: 59A, 84B)
  exclusive_area DECIMAL(6, 2),        -- 전용면적 (㎡)
  supply_area DECIMAL(6, 2),           -- 공급면적 (㎡)

  -- 방향 및 옵션
  direction VARCHAR(10),               -- 방향 (남향, 남동향 등)
  has_elevator BOOLEAN DEFAULT true,

  -- 외부 참조 (내부 용도)
  external_article_id VARCHAR(50),     -- 네이버 매물 ID (노출 안 함)

  -- 상태
  status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, SOLD, EXPIRED

  -- 메타
  crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_complex ON v2_properties(complex_id);
CREATE INDEX IF NOT EXISTS idx_properties_trade_type ON v2_properties(trade_type);
CREATE INDEX IF NOT EXISTS idx_properties_price ON v2_properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_status ON v2_properties(status);


-- 크롤링 작업 로그 테이블
CREATE TABLE IF NOT EXISTS v2_crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID REFERENCES v2_regions(id),

  status VARCHAR(20) NOT NULL,         -- PENDING, RUNNING, SUCCESS, FAILED
  trade_types TEXT[],                  -- 크롤링한 거래 유형

  -- 통계
  complexes_found INT DEFAULT 0,
  properties_found INT DEFAULT 0,

  -- 에러
  error_message TEXT,

  -- 시간
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON v2_crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_created ON v2_crawl_jobs(created_at DESC);


-- RLS (Row Level Security) 정책
ALTER TABLE v2_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_complexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_crawl_jobs ENABLE ROW LEVEL SECURITY;

-- 읽기 전용 정책 (모든 사용자)
CREATE POLICY "읽기 허용" ON v2_regions FOR SELECT USING (true);
CREATE POLICY "읽기 허용" ON v2_complexes FOR SELECT USING (true);
CREATE POLICY "읽기 허용" ON v2_properties FOR SELECT USING (true);

-- 쓰기 정책 (서비스 역할만)
CREATE POLICY "서비스 쓰기 허용" ON v2_regions FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "서비스 쓰기 허용" ON v2_complexes FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "서비스 쓰기 허용" ON v2_properties FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY "서비스 쓰기 허용" ON v2_crawl_jobs FOR ALL
  USING (auth.role() = 'service_role');

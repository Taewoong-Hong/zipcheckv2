"""
전국 지역구 좌표 데이터베이스
주요 시/군/구 좌표 정보
"""

# 전국 주요 지역 좌표 (시/군/구 중심)
KOREA_REGIONS = [
    # 서울특별시
    {"sido": "서울특별시", "sigungu": "강남구", "lat": 37.5172, "lon": 127.0473},
    {"sido": "서울특별시", "sigungu": "강동구", "lat": 37.5301, "lon": 127.1238},
    {"sido": "서울특별시", "sigungu": "강북구", "lat": 37.6396, "lon": 127.0257},
    {"sido": "서울특별시", "sigungu": "강서구", "lat": 37.5509, "lon": 126.8495},
    {"sido": "서울특별시", "sigungu": "관악구", "lat": 37.4784, "lon": 126.9516},
    {"sido": "서울특별시", "sigungu": "광진구", "lat": 37.5384, "lon": 127.0822},
    {"sido": "서울특별시", "sigungu": "구로구", "lat": 37.4954, "lon": 126.8874},
    {"sido": "서울특별시", "sigungu": "금천구", "lat": 37.4568, "lon": 126.8956},
    {"sido": "서울특별시", "sigungu": "노원구", "lat": 37.6542, "lon": 127.0568},
    {"sido": "서울특별시", "sigungu": "도봉구", "lat": 37.6688, "lon": 127.0471},
    {"sido": "서울특별시", "sigungu": "동대문구", "lat": 37.5744, "lon": 127.0399},
    {"sido": "서울특별시", "sigungu": "동작구", "lat": 37.5124, "lon": 126.9393},
    {"sido": "서울특별시", "sigungu": "마포구", "lat": 37.5663, "lon": 126.9019},
    {"sido": "서울특별시", "sigungu": "서대문구", "lat": 37.5791, "lon": 126.9368},
    {"sido": "서울특별시", "sigungu": "서초구", "lat": 37.4837, "lon": 127.0324},
    {"sido": "서울특별시", "sigungu": "성동구", "lat": 37.5634, "lon": 127.0371},
    {"sido": "서울특별시", "sigungu": "성북구", "lat": 37.5894, "lon": 127.0167},
    {"sido": "서울특별시", "sigungu": "송파구", "lat": 37.5145, "lon": 127.1059},
    {"sido": "서울특별시", "sigungu": "양천구", "lat": 37.5170, "lon": 126.8664},
    {"sido": "서울특별시", "sigungu": "영등포구", "lat": 37.5264, "lon": 126.8962},
    {"sido": "서울특별시", "sigungu": "용산구", "lat": 37.5324, "lon": 126.9900},
    {"sido": "서울특별시", "sigungu": "은평구", "lat": 37.6027, "lon": 126.9291},
    {"sido": "서울특별시", "sigungu": "종로구", "lat": 37.5730, "lon": 126.9794},
    {"sido": "서울특별시", "sigungu": "중구", "lat": 37.5641, "lon": 126.9979},
    {"sido": "서울특별시", "sigungu": "중랑구", "lat": 37.6063, "lon": 127.0926},

    # 인천광역시
    {"sido": "인천광역시", "sigungu": "계양구", "lat": 37.5372, "lon": 126.7379},
    {"sido": "인천광역시", "sigungu": "남동구", "lat": 37.4475, "lon": 126.7312},
    {"sido": "인천광역시", "sigungu": "동구", "lat": 37.4738, "lon": 126.6433},
    {"sido": "인천광역시", "sigungu": "미추홀구", "lat": 37.4633, "lon": 126.6505},
    {"sido": "인천광역시", "sigungu": "부평구", "lat": 37.5068, "lon": 126.7220},
    {"sido": "인천광역시", "sigungu": "서구", "lat": 37.5455, "lon": 126.6759},
    {"sido": "인천광역시", "sigungu": "연수구", "lat": 37.4106, "lon": 126.6781},
    {"sido": "인천광역시", "sigungu": "중구", "lat": 37.4738, "lon": 126.6214},
    {"sido": "인천광역시", "sigungu": "강화군", "lat": 37.7469, "lon": 126.4882},
    {"sido": "인천광역시", "sigungu": "옹진군", "lat": 37.4466, "lon": 126.6367},

    # 경기도
    {"sido": "경기도", "sigungu": "수원시", "lat": 37.2636, "lon": 127.0286},
    {"sido": "경기도", "sigungu": "성남시", "lat": 37.4200, "lon": 127.1266},
    {"sido": "경기도", "sigungu": "고양시", "lat": 37.6583, "lon": 126.8320},
    {"sido": "경기도", "sigungu": "용인시", "lat": 37.2411, "lon": 127.1776},
    {"sido": "경기도", "sigungu": "부천시", "lat": 37.5034, "lon": 126.7660},
    {"sido": "경기도", "sigungu": "안산시", "lat": 37.3218, "lon": 126.8309},
    {"sido": "경기도", "sigungu": "안양시", "lat": 37.3943, "lon": 126.9568},
    {"sido": "경기도", "sigungu": "남양주시", "lat": 37.6362, "lon": 127.2168},
    {"sido": "경기도", "sigungu": "화성시", "lat": 37.1991, "lon": 126.8311},
    {"sido": "경기도", "sigungu": "평택시", "lat": 36.9921, "lon": 127.1127},
    {"sido": "경기도", "sigungu": "시흥시", "lat": 37.3800, "lon": 126.8028},
    {"sido": "경기도", "sigungu": "파주시", "lat": 37.7599, "lon": 126.7800},
    {"sido": "경기도", "sigungu": "의정부시", "lat": 37.7381, "lon": 127.0338},
    {"sido": "경기도", "sigungu": "김포시", "lat": 37.6152, "lon": 126.7159},
    {"sido": "경기도", "sigungu": "광주시", "lat": 37.4292, "lon": 127.2552},
    {"sido": "경기도", "sigungu": "광명시", "lat": 37.4786, "lon": 126.8644},
    {"sido": "경기도", "sigungu": "군포시", "lat": 37.3616, "lon": 126.9352},
    {"sido": "경기도", "sigungu": "하남시", "lat": 37.5393, "lon": 127.2145},
    {"sido": "경기도", "sigungu": "오산시", "lat": 37.1497, "lon": 127.0773},
    {"sido": "경기도", "sigungu": "양주시", "lat": 37.7852, "lon": 127.0457},
    {"sido": "경기도", "sigungu": "이천시", "lat": 37.2720, "lon": 127.4350},
    {"sido": "경기도", "sigungu": "구리시", "lat": 37.5943, "lon": 127.1296},
    {"sido": "경기도", "sigungu": "안성시", "lat": 37.0079, "lon": 127.2797},
    {"sido": "경기도", "sigungu": "포천시", "lat": 37.8950, "lon": 127.2004},
    {"sido": "경기도", "sigungu": "의왕시", "lat": 37.3449, "lon": 126.9683},
    {"sido": "경기도", "sigungu": "양평군", "lat": 37.4910, "lon": 127.4874},
    {"sido": "경기도", "sigungu": "여주시", "lat": 37.2982, "lon": 127.6377},
    {"sido": "경기도", "sigungu": "동두천시", "lat": 37.9034, "lon": 127.0605},
    {"sido": "경기도", "sigungu": "가평군", "lat": 37.8314, "lon": 127.5095},
    {"sido": "경기도", "sigungu": "과천시", "lat": 37.4292, "lon": 126.9875},
    {"sido": "경기도", "sigungu": "연천군", "lat": 38.0960, "lon": 127.0746},

    # 부산광역시
    {"sido": "부산광역시", "sigungu": "강서구", "lat": 35.2121, "lon": 128.9806},
    {"sido": "부산광역시", "sigungu": "금정구", "lat": 35.2428, "lon": 129.0927},
    {"sido": "부산광역시", "sigungu": "남구", "lat": 35.1364, "lon": 129.0843},
    {"sido": "부산광역시", "sigungu": "동구", "lat": 35.1295, "lon": 129.0451},
    {"sido": "부산광역시", "sigungu": "동래구", "lat": 35.2047, "lon": 129.0839},
    {"sido": "부산광역시", "sigungu": "부산진구", "lat": 35.1629, "lon": 129.0530},
    {"sido": "부산광역시", "sigungu": "북구", "lat": 35.1975, "lon": 128.9903},
    {"sido": "부산광역시", "sigungu": "사상구", "lat": 35.1529, "lon": 128.9910},
    {"sido": "부산광역시", "sigungu": "사하구", "lat": 35.1042, "lon": 128.9743},
    {"sido": "부산광역시", "sigungu": "서구", "lat": 35.0971, "lon": 129.0244},
    {"sido": "부산광역시", "sigungu": "수영구", "lat": 35.1454, "lon": 129.1134},
    {"sido": "부산광역시", "sigungu": "연제구", "lat": 35.1761, "lon": 129.0799},
    {"sido": "부산광역시", "sigungu": "영도구", "lat": 35.0914, "lon": 129.0679},
    {"sido": "부산광역시", "sigungu": "중구", "lat": 35.1063, "lon": 129.0323},
    {"sido": "부산광역시", "sigungu": "해운대구", "lat": 35.1631, "lon": 129.1639},
    {"sido": "부산광역시", "sigungu": "기장군", "lat": 35.2447, "lon": 129.2221},

    # 대구광역시
    {"sido": "대구광역시", "sigungu": "남구", "lat": 35.8463, "lon": 128.5974},
    {"sido": "대구광역시", "sigungu": "달서구", "lat": 35.8299, "lon": 128.5326},
    {"sido": "대구광역시", "sigungu": "달성군", "lat": 35.7748, "lon": 128.4312},
    {"sido": "대구광역시", "sigungu": "동구", "lat": 35.8869, "lon": 128.6354},
    {"sido": "대구광역시", "sigungu": "북구", "lat": 35.8858, "lon": 128.5828},
    {"sido": "대구광역시", "sigungu": "서구", "lat": 35.8718, "lon": 128.5589},
    {"sido": "대구광역시", "sigungu": "수성구", "lat": 35.8581, "lon": 128.6311},
    {"sido": "대구광역시", "sigungu": "중구", "lat": 35.8694, "lon": 128.6066},

    # 광주광역시
    {"sido": "광주광역시", "sigungu": "광산구", "lat": 35.1397, "lon": 126.7935},
    {"sido": "광주광역시", "sigungu": "남구", "lat": 35.1328, "lon": 126.9026},
    {"sido": "광주광역시", "sigungu": "동구", "lat": 35.1460, "lon": 126.9227},
    {"sido": "광주광역시", "sigungu": "북구", "lat": 35.1740, "lon": 126.9119},
    {"sido": "광주광역시", "sigungu": "서구", "lat": 35.1519, "lon": 126.8895},

    # 대전광역시
    {"sido": "대전광역시", "sigungu": "대덕구", "lat": 36.3466, "lon": 127.4148},
    {"sido": "대전광역시", "sigungu": "동구", "lat": 36.3111, "lon": 127.4548},
    {"sido": "대전광역시", "sigungu": "서구", "lat": 36.3554, "lon": 127.3838},
    {"sido": "대전광역시", "sigungu": "유성구", "lat": 36.3622, "lon": 127.3563},
    {"sido": "대전광역시", "sigungu": "중구", "lat": 36.3254, "lon": 127.4210},

    # 울산광역시
    {"sido": "울산광역시", "sigungu": "남구", "lat": 35.5439, "lon": 129.3299},
    {"sido": "울산광역시", "sigungu": "동구", "lat": 35.5049, "lon": 129.4163},
    {"sido": "울산광역시", "sigungu": "북구", "lat": 35.5826, "lon": 129.3611},
    {"sido": "울산광역시", "sigungu": "중구", "lat": 35.5689, "lon": 129.3327},
    {"sido": "울산광역시", "sigungu": "울주군", "lat": 35.5221, "lon": 129.1543},

    # 세종특별자치시
    {"sido": "세종특별자치시", "sigungu": None, "lat": 36.4800, "lon": 127.2890},

    # 강원도
    {"sido": "강원도", "sigungu": "춘천시", "lat": 37.8813, "lon": 127.7300},
    {"sido": "강원도", "sigungu": "원주시", "lat": 37.3422, "lon": 127.9202},
    {"sido": "강원도", "sigungu": "강릉시", "lat": 37.7519, "lon": 128.8761},
    {"sido": "강원도", "sigungu": "동해시", "lat": 37.5247, "lon": 129.1144},
    {"sido": "강원도", "sigungu": "태백시", "lat": 37.1641, "lon": 128.9856},
    {"sido": "강원도", "sigungu": "속초시", "lat": 38.2070, "lon": 128.5919},
    {"sido": "강원도", "sigungu": "삼척시", "lat": 37.4500, "lon": 129.1656},

    # 충청북도
    {"sido": "충청북도", "sigungu": "청주시", "lat": 36.6424, "lon": 127.4890},
    {"sido": "충청북도", "sigungu": "충주시", "lat": 36.9910, "lon": 127.9259},
    {"sido": "충청북도", "sigungu": "제천시", "lat": 37.1326, "lon": 128.1911},

    # 충청남도
    {"sido": "충청남도", "sigungu": "천안시", "lat": 36.8151, "lon": 127.1139},
    {"sido": "충청남도", "sigungu": "공주시", "lat": 36.4465, "lon": 127.1189},
    {"sido": "충청남도", "sigungu": "보령시", "lat": 36.3330, "lon": 126.6129},
    {"sido": "충청남도", "sigungu": "아산시", "lat": 36.7898, "lon": 127.0016},
    {"sido": "충청남도", "sigungu": "서산시", "lat": 36.7848, "lon": 126.4503},
    {"sido": "충청남도", "sigungu": "논산시", "lat": 36.1870, "lon": 127.0986},
    {"sido": "충청남도", "sigungu": "계룡시", "lat": 36.2743, "lon": 127.2488},
    {"sido": "충청남도", "sigungu": "당진시", "lat": 36.8930, "lon": 126.6479},

    # 전라북도
    {"sido": "전라북도", "sigungu": "전주시", "lat": 35.8242, "lon": 127.1480},
    {"sido": "전라북도", "sigungu": "군산시", "lat": 35.9678, "lon": 126.7368},
    {"sido": "전라북도", "sigungu": "익산시", "lat": 35.9483, "lon": 126.9575},
    {"sido": "전라북도", "sigungu": "정읍시", "lat": 35.5699, "lon": 126.8560},
    {"sido": "전라북도", "sigungu": "남원시", "lat": 35.4164, "lon": 127.3904},
    {"sido": "전라북도", "sigungu": "김제시", "lat": 35.8036, "lon": 126.8809},

    # 전라남도
    {"sido": "전라남도", "sigungu": "목포시", "lat": 34.8118, "lon": 126.3922},
    {"sido": "전라남도", "sigungu": "여수시", "lat": 34.7604, "lon": 127.6622},
    {"sido": "전라남도", "sigungu": "순천시", "lat": 34.9507, "lon": 127.4872},
    {"sido": "전라남도", "sigungu": "나주시", "lat": 35.0160, "lon": 126.7109},
    {"sido": "전라남도", "sigungu": "광양시", "lat": 34.9407, "lon": 127.6956},

    # 경상북도
    {"sido": "경상북도", "sigungu": "포항시", "lat": 36.0190, "lon": 129.3435},
    {"sido": "경상북도", "sigungu": "경주시", "lat": 35.8562, "lon": 129.2247},
    {"sido": "경상북도", "sigungu": "김천시", "lat": 36.1399, "lon": 128.1137},
    {"sido": "경상북도", "sigungu": "안동시", "lat": 36.5684, "lon": 128.7294},
    {"sido": "경상북도", "sigungu": "구미시", "lat": 36.1195, "lon": 128.3446},
    {"sido": "경상북도", "sigungu": "영주시", "lat": 36.8056, "lon": 128.6239},
    {"sido": "경상북도", "sigungu": "영천시", "lat": 35.9733, "lon": 128.9386},
    {"sido": "경상북도", "sigungu": "상주시", "lat": 36.4109, "lon": 128.1589},
    {"sido": "경상북도", "sigungu": "문경시", "lat": 36.5864, "lon": 128.1867},
    {"sido": "경상북도", "sigungu": "경산시", "lat": 35.8250, "lon": 128.7414},

    # 경상남도
    {"sido": "경상남도", "sigungu": "창원시", "lat": 35.2281, "lon": 128.6811},
    {"sido": "경상남도", "sigungu": "진주시", "lat": 35.1800, "lon": 128.1076},
    {"sido": "경상남도", "sigungu": "통영시", "lat": 34.8544, "lon": 128.4331},
    {"sido": "경상남도", "sigungu": "사천시", "lat": 35.0036, "lon": 128.0642},
    {"sido": "경상남도", "sigungu": "김해시", "lat": 35.2286, "lon": 128.8894},
    {"sido": "경상남도", "sigungu": "밀양시", "lat": 35.5037, "lon": 128.7462},
    {"sido": "경상남도", "sigungu": "거제시", "lat": 34.8806, "lon": 128.6211},
    {"sido": "경상남도", "sigungu": "양산시", "lat": 35.3350, "lon": 129.0374},

    # 제주특별자치도
    {"sido": "제주특별자치도", "sigungu": "제주시", "lat": 33.4996, "lon": 126.5312},
    {"sido": "제주특별자치도", "sigungu": "서귀포시", "lat": 33.2541, "lon": 126.5601},
]


def get_all_regions():
    """전국 지역 리스트 반환"""
    return KOREA_REGIONS


def find_region_by_name(sido: str, sigungu: str = None):
    """
    시/도, 시/군/구로 지역 검색

    Args:
        sido: 시/도명
        sigungu: 시/군/구명 (선택)

    Returns:
        해당 지역 정보 또는 None
    """
    for region in KOREA_REGIONS:
        if region["sido"] == sido:
            if sigungu is None or region["sigungu"] == sigungu:
                return region
    return None


def get_nearby_regions(lat: float, lon: float, max_distance_km: float = 50):
    """
    특정 좌표 근처 지역 검색

    Args:
        lat: 위도
        lon: 경도
        max_distance_km: 최대 거리 (km)

    Returns:
        거리순 정렬된 지역 리스트
    """
    import math

    def haversine_distance(lat1, lon1, lat2, lon2):
        """두 좌표 간 거리 계산 (km)"""
        R = 6371  # 지구 반지름 (km)
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        c = 2 * math.asin(math.sqrt(a))
        return R * c

    results = []
    for region in KOREA_REGIONS:
        distance = haversine_distance(
            lat, lon,
            region["lat"], region["lon"]
        )
        if distance <= max_distance_km:
            results.append({**region, "distance_km": round(distance, 2)})

    # 거리순 정렬
    results.sort(key=lambda x: x["distance_km"])
    return results


# 테스트
if __name__ == "__main__":
    print(f"전국 지역수: {len(KOREA_REGIONS)}")

    # 강남구 검색
    gangnam = find_region_by_name("서울특별시", "강남구")
    print(f"\n강남구: {gangnam}")

    # 강남역 근처 지역
    nearby = get_nearby_regions(37.498095, 127.027610, max_distance_km=10)
    print(f"\n강남역 반경 10km 지역: {len(nearby)}개")
    for r in nearby[:5]:
        print(f"  {r['sido']} {r['sigungu']}: {r['distance_km']}km")

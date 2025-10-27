# IROS 등기부등본 자동 발급 RPA - 테스트 검증된 선택자 목록

> **테스트 일자**: 2025-01-24
> **테스트 환경**: Playwright MCP (Chromium)
> **테스트 대상**: https://www.iros.go.kr/
> **테스트 시나리오**: 로그인 → 검색 → 선택 → 발급 → 결제

---

## 🔐 1. 로그인 플로우

### 1.1 로그인 페이지 접근 (2단계 필수)
```python
# Step 1: 헤더 로그인 드롭다운 버튼 클릭
"login_dropdown_button": "a:has-text('로그인')"

# Step 2: 드롭다운에서 로그인 링크 클릭
"login_dropdown_link": "a:has-text('로그인')"
```

**⚠️ 중요**: 단일 클릭이 아닌 2단계 네비게이션 필요

### 1.2 로그인 폼
```python
"username_input": "input[placeholder='아이디']"
"password_input": "input[placeholder='비밀번호']"
"login_submit_button": "button:has-text('로그인')"
```

**참고**: 사용자명 필드가 pre-filled 될 수 있음 → 빈 필드/채워진 필드 모두 처리 필요

### 1.3 로그인 성공 검증
```python
"login_success_indicator": "text=/홍태웅 님|로그아웃/"
```

---

## 🔍 2. 부동산 검색

### 2.1 메인 페이지 검색
```python
"search_input_main": "textbox \"부동산및법인조회입력\""
"search_button_main": "link \"search\""
```

**테스트 주소**: "서울특별시 강남구 테헤란로 152"

### 2.2 검색 결과 선택 (라디오 버튼)

**CSS 선택자**:
```python
"result_radio_first": "#grd_smpl_srch_rslt___radio_rad_sel_0"
```

**⚠️ 중요**: 라벨 요소가 클릭을 가로막음 → **JavaScript 평가 필수**

**JavaScript 해결 방법**:
```python
"result_radio_js": """
    const radio = document.querySelector('#grd_smpl_srch_rslt___radio_rad_sel_0');
    radio.checked = true;
    radio.click();
"""
```

---

## 🏠 3. 부동산 선택 (체크박스)

### ⚠️ 🚨 **CRITICAL BUG 발견**

**문제**: 개별 부동산 체크박스를 선택해도 IROS 웹사이트가 선택을 인식하지 못함
- HTML에서는 `[checked]` 표시됨
- 웹사이트 검증 실패: "열람발급할 부동산을 선택하시기 바랍니다" 알림 반복

**시도한 해결 방법 (모두 실패)**:
1. ❌ 직접 `checkbox.click()`
2. ❌ `checked=true` 설정 후 `click()`
3. ❌ `change` 이벤트 수동 디스패치

### ✅ **해결책: 전체선택 체크박스 사용**

```python
# 헤더 "전체선택" 체크박스 (index 4)
"property_select_all_checkbox": "#wq_uuid_4549_header__chk_all_checkboxLabel__id"

# JavaScript 클릭 방법
"property_select_all_js": """
    const allCheckbox = document.querySelector('#wq_uuid_4549_header__chk_all_checkboxLabel__id');
    allCheckbox.click();
"""
```

**권장 사항**:
- RPA 스크립트는 **항상 전체선택 사용**
- 개별 선택은 IROS 시스템과 호환되지 않음
- 특정 부동산만 선택이 필요한 경우 별도 필터링 로직 구현 필요

### 3.1 다음 버튼 (부동산 선택 후)
```python
"next_button_after_property_select": "#mf_wfm_potal_main_wfm_content_btn_next"
```

---

## ⚠️ 4. 과다등기부 경고 페이지 (조건부)

**발생 조건**: 등기명의인이 100명 이상인 부동산
**테스트 케이스**: 185명 등기명의인 부동산

**처리**: 동일한 "다음" 버튼 클릭
```python
"next_button_excessive_warning": "#mf_wfm_potal_main_wfm_content_btn_next"
```

**시스템 제약**:
- 100명 초과: 처리 시간 5분 이상 소요 가능
- 500명 초과: 온라인 조회 불가

---

## 📄 5. 발급 옵션 선택

### 5.1 용도 선택 (발급 vs 열람)

**발급(출력) 라디오 버튼**:
```python
"purpose_issuance_radio": "#mf_wfm_potal_main_wfm_content_rad_usg_cls_input_1"
```

**⚠️ 중요**: 라벨 가로막음 → **JavaScript + Event Dispatch 필수**

**JavaScript 해결 방법**:
```python
"purpose_issuance_js": """
    const radio = document.querySelector('#mf_wfm_potal_main_wfm_content_rad_usg_cls_input_1');
    radio.checked = true;
    radio.click();
    const event = new Event('change', { bubbles: true });
    radio.dispatchEvent(event);
"""
```

**참고**:
- `data-index="1"`: 발급(출력) - 1,000원
- `data-index="0"`: 열람 - 700원 (7일 제한)

### 5.2 등기부 종류 (기본값 사용)
```python
"registry_type_complete": "radio \"전부\""  # 기본 선택됨
"record_type_dropdown": "combobox \"등초본종류선택\""  # 필요시
```

### 5.3 다음 버튼 (옵션 선택 후)
```python
"next_button_after_options": "#mf_wfm_potal_main_wfm_content_btn_next"
```

---

## 🔒 6. (주민)등록번호 공개여부

### 6.1 미공개 선택 (기본값)
```python
"privacy_undisclosed_radio": "radio \"미공개\""  # 기본 선택됨
```

### 6.2 다음 버튼 (개인정보 설정 후)
```python
"next_button_after_privacy": "#mf_wfm_potal_main_wfm_content_btn_next"
```

---

## 💳 7. 결제 확인

### 7.1 결제대상 확인 페이지
```python
"payment_button": "link \"결제\""
```

**확인 정보**:
- 수수료: 1,000원
- 건수: 1건
- 예상처리시간: 발급일 경과 후 최대 3시간

---

## 💳 8. 최종 결제 페이지

### 8.1 결제 수단 선택
```python
"payment_tab_card": "link \"신용카드결제\""  # 기본 선택됨
```

### 8.2 약관 동의 체크박스
```python
"agree_all_checkbox": "checkbox \"전체동의\""
"agree_payment_info": "checkbox \"위 내용에 동의합니다.\""
"agree_payment_service": "checkbox \"전자지급결제대행 서비스 이용 약관 동의\""
"agree_privacy_collection": "checkbox \"개인정보 수집 및 이용 약관 동의\""
"agree_privacy_third_party": "checkbox \"개인정보 제3자 제공 및 위탁 약관 동의\""
```

**권장**: `agree_all_checkbox` 클릭 시 하위 체크박스 자동 선택

### 8.3 카드 선택
```python
# 사용 가능한 카드사
- NH 농협카드
- 신한카드
- 비씨카드
- KB국민카드
- 현대카드
- 삼성카드
- 롯데카드
- 하나카드
- 우리카드
```

### 8.4 최종 결제 버튼
```python
"final_payment_button": "link \"결제\""
```

---

## 📦 Python Dictionary (통합본)

```python
IROS_SELECTORS = {
    # ===== 로그인 플로우 =====
    "login_dropdown_button": "a:has-text('로그인')",
    "login_dropdown_link": "a:has-text('로그인')",
    "username_input": "input[placeholder='아이디']",
    "password_input": "input[placeholder='비밀번호']",
    "login_submit_button": "button:has-text('로그인')",
    "login_success_indicator": "text=/홍태웅 님|로그아웃/",

    # ===== 검색 =====
    "search_input_main": "textbox \"부동산및법인조회입력\"",
    "search_button_main": "link \"search\"",

    # ===== 검색 결과 선택 =====
    "result_radio_first": "#grd_smpl_srch_rslt___radio_rad_sel_0",
    "result_radio_js": """
        const radio = document.querySelector('#grd_smpl_srch_rslt___radio_rad_sel_0');
        radio.checked = true;
        radio.click();
    """,

    # ===== 부동산 선택 (⚠️ 전체선택 사용 필수) =====
    "property_select_all_checkbox": "#wq_uuid_4549_header__chk_all_checkboxLabel__id",
    "property_select_all_js": """
        const allCheckbox = document.querySelector('#wq_uuid_4549_header__chk_all_checkboxLabel__id');
        allCheckbox.click();
    """,
    "next_button_after_property_select": "#mf_wfm_potal_main_wfm_content_btn_next",

    # ===== 과다등기부 경고 (조건부) =====
    "next_button_excessive_warning": "#mf_wfm_potal_main_wfm_content_btn_next",

    # ===== 발급 옵션 =====
    "purpose_issuance_radio": "#mf_wfm_potal_main_wfm_content_rad_usg_cls_input_1",
    "purpose_issuance_js": """
        const radio = document.querySelector('#mf_wfm_potal_main_wfm_content_rad_usg_cls_input_1');
        radio.checked = true;
        radio.click();
        const event = new Event('change', { bubbles: true });
        radio.dispatchEvent(event);
    """,
    "registry_type_complete": "radio \"전부\"",
    "record_type_dropdown": "combobox \"등초본종류선택\"",
    "next_button_after_options": "#mf_wfm_potal_main_wfm_content_btn_next",

    # ===== 개인정보 설정 =====
    "privacy_undisclosed_radio": "radio \"미공개\"",
    "next_button_after_privacy": "#mf_wfm_potal_main_wfm_content_btn_next",

    # ===== 결제 확인 =====
    "payment_button": "link \"결제\"",

    # ===== 최종 결제 =====
    "payment_tab_card": "link \"신용카드결제\"",
    "agree_all_checkbox": "checkbox \"전체동의\"",
    "agree_payment_info": "checkbox \"위 내용에 동의합니다.\"",
    "agree_payment_service": "checkbox \"전자지급결제대행 서비스 이용 약관 동의\"",
    "agree_privacy_collection": "checkbox \"개인정보 수집 및 이용 약관 동의\"",
    "agree_privacy_third_party": "checkbox \"개인정보 제3자 제공 및 위탁 약관 동의\"",
    "final_payment_button": "link \"결제\"",
}
```

---

## 🔧 JavaScript 헬퍼 함수

```python
def click_with_js(page, selector: str):
    """라벨 가로막힘 방지용 JavaScript 클릭"""
    page.evaluate(f"""
        const element = document.querySelector('{selector}');
        element.click();
    """)

def select_radio_with_dispatch(page, selector: str):
    """라디오 버튼 선택 + change 이벤트 디스패치"""
    page.evaluate(f"""
        const radio = document.querySelector('{selector}');
        radio.checked = true;
        radio.click();
        const event = new Event('change', {{ bubbles: true }});
        radio.dispatchEvent(event);
    """)

def select_all_properties(page):
    """전체선택 체크박스 클릭 (개별 선택 대신 사용)"""
    page.evaluate("""
        const allCheckbox = document.querySelector('#wq_uuid_4549_header__chk_all_checkboxLabel__id');
        allCheckbox.click();
    """)
```

---

## ⚠️ 주요 발견사항 및 주의사항

### 1. 개별 체크박스 선택 불가 (Critical)
- 개별 부동산 체크박스는 IROS 시스템과 호환되지 않음
- **반드시 전체선택 체크박스 사용**

### 2. JavaScript 평가 필수 요소
- 라디오 버튼 (검색 결과, 발급 옵션)
- 전체선택 체크박스
- 라벨이 가로막는 모든 입력 요소

### 3. 2단계 로그인 네비게이션
- 드롭다운 버튼 → 드롭다운 링크 순서 필수

### 4. 과다등기부 조건부 처리
- 100명 이상 등기명의인 시 추가 페이지 발생
- 동일한 "다음" 버튼으로 진행

### 5. 기본값 활용
- 등기부 종류: "전부" (기본 선택)
- 개인정보: "미공개" (기본 선택)
- 결제 수단: "신용카드결제" (기본 탭)

---

## 📋 다음 단계

1. ✅ **선택자 문서화 완료**
2. ⏳ **RPA 스크립트 업데이트** (`services/ai/rpa/registry_rpa.py`)
3. ⏳ **실제 결제 및 PDF 다운로드 테스트**
4. ⏳ **PDF 저장 로직 구현** (Supabase Storage 연동)
5. ⏳ **에러 핸들링 및 재시도 로직**
6. ⏳ **통합 테스트 및 검증**

---

## 📞 문의 및 지원

테스트 일자: 2025-01-24
테스트 담당: Claude (Playwright MCP)
문서 버전: 1.0

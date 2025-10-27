"""
IROS Playwright Navigation Logic
완전 자동화된 등기부등본 발급 플로우 (로그인 → 검색 → 선택 → 결제 → 다운로드)
"""
import logging
from typing import Optional, Dict, Any
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IROSPlaywrightNavigation:
    """IROS 웹사이트 Playwright 자동화 네비게이션"""

    def __init__(self):
        self.base_url = "https://www.iros.go.kr"

    async def login_non_member(self, page, phone: str, password: str) -> bool:
        """
        비회원 로그인 (전화번호 + 4자리 비밀번호)

        Args:
            page: Playwright page object
            phone: 전화번호 (예: "01012345678", 하이픈 없이)
            password: 4자리 숫자 비밀번호

        Returns:
            True if login successful, False otherwise
        """
        try:
            logger.info("=" * 60)
            logger.info("Step 1: 비회원 로그인")
            logger.info("=" * 60)

            # 메인 페이지로 이동
            logger.info(f"Navigating to: {self.base_url}/PMainJ.jsp")
            await page.goto(f"{self.base_url}/PMainJ.jsp")
            await page.wait_for_load_state("networkidle")

            # 로그인 버튼 클릭
            logger.info("Clicking 로그인 button...")
            await page.evaluate("""() => {
                const loginBtn = document.querySelector('a[href*="javascript:void(null)"]');
                if (loginBtn && loginBtn.textContent.includes('로그인')) {
                    loginBtn.click();
                    return true;
                }
                return false;
            }""")

            # 로그인 다이얼로그가 나타날 때까지 대기
            await page.wait_for_timeout(2000)

            # 비회원 로그인 필드 찾기 및 입력
            logger.info(f"Entering phone number: {phone}")
            phone_input_filled = await page.evaluate(f"""() => {{
                const phoneInput = document.querySelector('input[placeholder*="없이 숫자입력"]') ||
                                  document.querySelector('input[placeholder*="전화번호"]');
                if (phoneInput) {{
                    phoneInput.value = '{phone}';
                    phoneInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    phoneInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }}
                return false;
            }}""")

            if not phone_input_filled:
                logger.error("Failed to find phone number input field")
                return False

            logger.info(f"Entering password: {'*' * len(password)}")
            password_input_filled = await page.evaluate(f"""() => {{
                const pwInputs = Array.from(document.querySelectorAll('input[type="password"], input[type="text"]'));
                const pwInput = pwInputs.find(input =>
                    input.placeholder && (
                        input.placeholder.includes('4자리') ||
                        input.placeholder.includes('비밀번호')
                    )
                );
                if (pwInput) {{
                    pwInput.value = '{password}';
                    pwInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    pwInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }}
                return false;
            }}""")

            if not password_input_filled:
                logger.error("Failed to find password input field")
                return False

            # 로그인 버튼 클릭
            logger.info("Clicking non-member login button...")
            login_clicked = await page.evaluate("""() => {
                // 비회원 로그인 영역의 버튼 찾기
                const buttons = Array.from(document.querySelectorAll('button'));
                const loginBtn = buttons.find(btn => btn.textContent.includes('로그인'));
                if (loginBtn) {
                    // 비회원 로그인 섹션 내부인지 확인
                    const parent = loginBtn.closest('table');
                    if (parent && parent.textContent.includes('전화번호')) {
                        loginBtn.click();
                        return true;
                    }
                }
                return false;
            }""")

            if not login_clicked:
                logger.error("Failed to click login button")
                return False

            # 로그인 완료 대기 (페이지 변화 확인)
            await page.wait_for_timeout(3000)

            logger.info("✅ 비회원 로그인 완료")
            return True

        except Exception as e:
            logger.error(f"Error during non-member login: {e}", exc_info=True)
            return False

    async def search_property(self, page, address: str) -> bool:
        """
        부동산 검색

        Args:
            page: Playwright page object
            address: 검색할 주소 (예: "인천시 중구 인중로 290 1108")

        Returns:
            True if search successful and results found
        """
        try:
            logger.info("=" * 60)
            logger.info("Step 2: 부동산 검색")
            logger.info("=" * 60)

            logger.info(f"Searching for: {address}")

            # 검색창에 주소 입력
            search_filled = await page.evaluate(f"""() => {{
                const searchInput = document.querySelector('input[placeholder*="주소를 입력하세요"]') ||
                                   document.querySelector('input[id*="search"]') ||
                                   document.querySelector('input[name*="search"]');
                if (searchInput) {{
                    searchInput.value = '{address}';
                    searchInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    searchInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }}
                return false;
            }}""")

            if not search_filled:
                logger.error("Failed to find search input")
                return False

            # 검색 버튼 클릭
            logger.info("Clicking search button...")
            search_clicked = await page.evaluate("""() => {
                const searchBtn = document.querySelector('a[href*="javascript:void(null)"]') ||
                                 document.querySelector('button[type="submit"]');
                if (searchBtn) {
                    searchBtn.click();
                    return true;
                }
                return false;
            }""")

            if not search_clicked:
                logger.error("Failed to click search button")
                return False

            # 검색 결과 대기
            await page.wait_for_timeout(3000)

            logger.info("✅ 검색 완료")
            return True

        except Exception as e:
            logger.error(f"Error during property search: {e}", exc_info=True)
            return False

    async def select_property(self, page, property_index: int = 0) -> bool:
        """
        검색 결과에서 부동산 선택

        Args:
            page: Playwright page object
            property_index: 선택할 부동산 인덱스 (0부터 시작)

        Returns:
            True if selection successful
        """
        try:
            logger.info("=" * 60)
            logger.info(f"Step 3: 부동산 선택 (index: {property_index})")
            logger.info("=" * 60)

            # 라디오 버튼 선택
            radio_selected = await page.evaluate(f"""() => {{
                const radios = document.querySelectorAll('input[type="radio"][name*="rad_sel"]');
                if (radios && radios.length > {property_index}) {{
                    const radio = radios[{property_index}];
                    radio.checked = true;
                    radio.click();
                    radio.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }}
                return false;
            }}""")

            if not radio_selected:
                logger.error(f"Failed to select property at index {property_index}")
                return False

            await page.wait_for_timeout(1000)

            # 다음 버튼 클릭
            logger.info("Clicking 다음 button...")
            next_clicked = await page.evaluate("""() => {
                const nextBtn = document.querySelector('#mf_wfm_potal_main_wfm_content_btn_next') ||
                               document.querySelector('a[href*="javascript:void(null)"]');
                if (nextBtn && nextBtn.textContent.includes('다음')) {
                    nextBtn.click();
                    return true;
                }
                return false;
            }""")

            if not next_clicked:
                logger.error("Failed to click 다음 button")
                return False

            await page.wait_for_timeout(2000)

            logger.info("✅ 부동산 선택 완료")
            return True

        except Exception as e:
            logger.error(f"Error during property selection: {e}", exc_info=True)
            return False

    async def select_location(self, page) -> bool:
        """
        소재지번 선택

        Args:
            page: Playwright page object

        Returns:
            True if selection successful
        """
        try:
            logger.info("=" * 60)
            logger.info("Step 4: 소재지번 선택")
            logger.info("=" * 60)

            # 체크박스 선택 (첫 번째 항목)
            checkbox_selected = await page.evaluate("""() => {
                const checkboxes = document.querySelectorAll('input[type="checkbox"][id*="chk_sel"]');
                if (checkboxes && checkboxes.length > 0) {
                    const checkbox = checkboxes[0];
                    checkbox.checked = true;
                    checkbox.click();
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            }""")

            if not checkbox_selected:
                # 라벨 클릭 시도
                logger.info("Trying to click checkbox label...")
                label_clicked = await page.evaluate("""() => {
                    const labels = document.querySelectorAll('label[for*="chk_sel"]');
                    if (labels && labels.length > 0) {
                        labels[0].click();
                        return true;
                    }
                    return false;
                }""")

                if not label_clicked:
                    logger.error("Failed to select location checkbox")
                    return False

            await page.wait_for_timeout(1000)

            # 다음 버튼 클릭
            logger.info("Clicking 다음 button...")
            next_clicked = await page.evaluate("""() => {
                const nextBtn = document.querySelector('#mf_wfm_potal_main_wfm_content_btn_next');
                if (nextBtn) {
                    nextBtn.click();
                    return true;
                }
                return false;
            }""")

            if not next_clicked:
                logger.error("Failed to click 다음 button")
                return False

            await page.wait_for_timeout(2000)

            logger.info("✅ 소재지번 선택 완료")
            return True

        except Exception as e:
            logger.error(f"Error during location selection: {e}", exc_info=True)
            return False

    async def select_issuance_options(self, page, issue_type: str = "발급") -> bool:
        """
        발급 옵션 선택 (열람 700원 or 발급 1,000원)

        Args:
            page: Playwright page object
            issue_type: "열람" or "발급" (default: "발급")

        Returns:
            True if selection successful
        """
        try:
            logger.info("=" * 60)
            logger.info(f"Step 5: 발급 옵션 선택 ({issue_type})")
            logger.info("=" * 60)

            # 발급/열람 라디오 버튼 선택
            radio_selected = await page.evaluate(f"""() => {{
                const radios = document.querySelectorAll('input[type="radio"][name*="usg_cls"]');
                for (const radio of radios) {{
                    const label = document.querySelector(`label[for="${{radio.id}}"]`);
                    if (label && label.textContent.includes('{issue_type}')) {{
                        radio.checked = true;
                        radio.click();
                        radio.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        return true;
                    }}
                }}
                return false;
            }}""")

            if not radio_selected:
                logger.error(f"Failed to select {issue_type} option")
                return False

            await page.wait_for_timeout(1000)

            # 다음 버튼 클릭
            logger.info("Clicking 다음 button...")
            next_clicked = await page.evaluate("""() => {
                const nextBtn = document.querySelector('#mf_wfm_potal_main_wfm_content_btn_next');
                if (nextBtn) {
                    nextBtn.click();
                    return true;
                }
                return false;
            }""")

            if not next_clicked:
                logger.error("Failed to click 다음 button")
                return False

            await page.wait_for_timeout(2000)

            logger.info(f"✅ {issue_type} 옵션 선택 완료")
            return True

        except Exception as e:
            logger.error(f"Error during issuance option selection: {e}", exc_info=True)
            return False

    async def set_privacy_options(self, page, disclosure: str = "미공개") -> bool:
        """
        주민등록번호 공개여부 설정

        Args:
            page: Playwright page object
            disclosure: "미공개" or "특정인공개" (default: "미공개")

        Returns:
            True if setting successful
        """
        try:
            logger.info("=" * 60)
            logger.info(f"Step 6: 주민등록번호 공개여부 설정 ({disclosure})")
            logger.info("=" * 60)

            # 미공개/특정인공개 라디오 버튼 (기본값이 미공개이므로 변경 필요시에만)
            if disclosure != "미공개":
                radio_selected = await page.evaluate(f"""() => {{
                    const radios = document.querySelectorAll('input[type="radio"]');
                    for (const radio of radios) {{
                        const label = document.querySelector(`label[for="${{radio.id}}"]`);
                        if (label && label.textContent.includes('{disclosure}')) {{
                            radio.checked = true;
                            radio.click();
                            radio.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            return true;
                        }}
                    }}
                    return false;
                }}""")

                if not radio_selected:
                    logger.warning(f"Failed to select {disclosure} option, keeping default")

            await page.wait_for_timeout(1000)

            # 다음 버튼 클릭
            logger.info("Clicking 다음 button...")
            next_clicked = await page.evaluate("""() => {
                const nextBtn = document.querySelector('#mf_wfm_potal_main_wfm_content_btn_next');
                if (nextBtn) {
                    nextBtn.click();
                    return true;
                }
                return false;
            }""")

            if not next_clicked:
                logger.error("Failed to click 다음 button")
                return False

            await page.wait_for_timeout(2000)

            logger.info(f"✅ 주민등록번호 {disclosure} 설정 완료")
            return True

        except Exception as e:
            logger.error(f"Error during privacy option setting: {e}", exc_info=True)
            return False

    async def proceed_to_payment(self, page) -> bool:
        """
        결제 페이지로 진행

        Args:
            page: Playwright page object

        Returns:
            True if navigation to payment page successful
        """
        try:
            logger.info("=" * 60)
            logger.info("Step 7: 결제 페이지로 진행")
            logger.info("=" * 60)

            # 결제 버튼 클릭
            logger.info("Clicking 결제 button...")
            payment_clicked = await page.evaluate("""() => {
                const paymentBtn = document.querySelector('a[href*="javascript:void(null)"]');
                if (paymentBtn && paymentBtn.textContent.includes('결제')) {
                    paymentBtn.click();
                    return true;
                }
                return false;
            }""")

            if not payment_clicked:
                logger.error("Failed to click 결제 button")
                return False

            await page.wait_for_timeout(3000)

            logger.info("✅ 결제 페이지 진입 완료")
            logger.info("💡 이제 결제를 완료하고 '신청결과 확인 > 열람·발급' 페이지로 이동해야 합니다")
            return True

        except Exception as e:
            logger.error(f"Error during payment navigation: {e}", exc_info=True)
            return False

    async def navigate_to_unissued_documents(self, page) -> bool:
        """
        미열람·미발급 페이지로 이동
        결제 완료 후 이 페이지에서 '발급' 버튼을 눌러 다운로드

        Args:
            page: Playwright page object

        Returns:
            True if navigation successful
        """
        try:
            logger.info("=" * 60)
            logger.info("Step 8: 미열람·미발급 페이지로 이동")
            logger.info("=" * 60)

            # URL 직접 이동 (가장 확실한 방법)
            unissued_url = f"{self.base_url}/frontservlet?cmd=RISUBizNoRegaPbAct"
            logger.info(f"Navigating to: {unissued_url}")
            await page.goto(unissued_url)
            await page.wait_for_load_state("networkidle")

            await page.wait_for_timeout(2000)

            logger.info("✅ 미열람·미발급 페이지 진입 완료")
            logger.info("💡 이제 '발급' 버튼을 클릭하여 PDF 다운로드를 시작할 수 있습니다")
            return True

        except Exception as e:
            logger.error(f"Error navigating to unissued documents page: {e}", exc_info=True)
            return False

    async def click_issue_button(self, page) -> bool:
        """
        '발급' 버튼 클릭 (PDF 다운로드 트리거)

        Args:
            page: Playwright page object

        Returns:
            True if button click successful
        """
        try:
            logger.info("=" * 60)
            logger.info("Step 9: '발급' 버튼 클릭")
            logger.info("=" * 60)

            # 발급 버튼 찾기 및 클릭
            issue_clicked = await page.evaluate("""() => {
                // 미열람·미발급 목록에서 '발급' 버튼 찾기
                const buttons = Array.from(document.querySelectorAll('button, a'));
                const issueBtn = buttons.find(btn =>
                    btn.textContent.trim() === '발급' ||
                    btn.textContent.includes('발급')
                );
                if (issueBtn) {
                    issueBtn.click();
                    return true;
                }
                return false;
            }""")

            if not issue_clicked:
                logger.error("Failed to click 발급 button")
                return False

            logger.info("✅ '발급' 버튼 클릭 완료")
            logger.info("💡 이제 ePageSAFER 모달이 나타날 것입니다. PyAutoGUI 핸들러가 자동으로 처리합니다...")

            return True

        except Exception as e:
            logger.error(f"Error clicking issue button: {e}", exc_info=True)
            return False


async def run_full_flow(
    phone: str,
    password: str,
    address: str,
    property_index: int = 0
) -> bool:
    """
    전체 플로우 실행 (테스트용)

    Args:
        phone: 전화번호 (하이픈 없이)
        password: 4자리 비밀번호
        address: 검색할 부동산 주소
        property_index: 선택할 부동산 인덱스 (여러 결과가 있을 경우)

    Returns:
        True if all steps successful
    """
    from playwright.async_api import async_playwright

    nav = IROSPlaywrightNavigation()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        try:
            # Step 1: 로그인
            if not await nav.login_non_member(page, phone, password):
                return False

            # Step 2: 부동산 검색
            if not await nav.search_property(page, address):
                return False

            # Step 3: 부동산 선택
            if not await nav.select_property(page, property_index):
                return False

            # Step 4: 소재지번 선택
            if not await nav.select_location(page):
                return False

            # Step 5: 발급 옵션 선택
            if not await nav.select_issuance_options(page, "발급"):
                return False

            # Step 6: 주민등록번호 미공개 설정
            if not await nav.set_privacy_options(page, "미공개"):
                return False

            # Step 7: 결제 페이지 진행
            if not await nav.proceed_to_payment(page):
                return False

            logger.info("=" * 60)
            logger.info("⏸️  결제 완료 대기 중...")
            logger.info("결제를 완료한 후 Enter를 눌러 계속하세요")
            logger.info("=" * 60)
            input()

            # Step 8: 미열람·미발급 페이지 이동
            if not await nav.navigate_to_unissued_documents(page):
                return False

            # Step 9: 발급 버튼 클릭
            if not await nav.click_issue_button(page):
                return False

            logger.info("=" * 60)
            logger.info("✅ 모든 네비게이션 단계 완료!")
            logger.info("💡 이제 ePageSAFER 핸들러와 PDF 변환이 자동으로 진행됩니다")
            logger.info("=" * 60)

            # 다운로드 완료 대기 (실제로는 iros_complete_flow.py에서 처리)
            await page.wait_for_timeout(10000)

            return True

        except Exception as e:
            logger.error(f"Error in full flow: {e}", exc_info=True)
            return False
        finally:
            await browser.close()


if __name__ == "__main__":
    import asyncio

    # 테스트 설정
    TEST_PHONE = "01012345678"  # 실제 전화번호로 변경 필요
    TEST_PASSWORD = "1234"  # 실제 4자리 비밀번호로 변경 필요
    TEST_ADDRESS = "인천시 중구 인중로 290 1108"

    print("=" * 60)
    print("IROS Playwright Navigation Test")
    print("=" * 60)
    print("⚠️  주의: 실제 전화번호와 비밀번호를 설정해야 합니다")
    print("=" * 60)

    asyncio.run(run_full_flow(TEST_PHONE, TEST_PASSWORD, TEST_ADDRESS))

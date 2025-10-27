"""
등기부등본 자동 발급 RPA (Robotic Process Automation)

대법원 인터넷등기소(www.iros.go.kr)를 통한 등기부등본 자동 발급
Playwright 기반 브라우저 자동화

주요 기능:
- 주소 검색 및 부동산 선택
- 등기부등본 발급 신청
- PDF 다운로드 및 저장
- 에러 핸들링 및 재시도 로직
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

from playwright.async_api import async_playwright, Page, Browser, BrowserContext, TimeoutError as PlaywrightTimeoutError

logger = logging.getLogger(__name__)


class RegistryRPAError(Exception):
    """RPA 관련 에러"""
    pass


class RegistryRPA:
    """등기부등본 자동 발급 RPA 클래스"""

    IROS_URL = "https://www.iros.go.kr/index.jsp"
    LOGIN_URL = "https://www.iros.go.kr/MMain.jsp"

    # 선택자 (Playwright MCP로 확인된 실제 선택자)
    SELECTORS = {
        # 로그인 (role-based selectors 사용 권장)
        "login_button_header": "a:has-text('로그인')",  # 헤더의 로그인 버튼
        "user_id_input": "input[placeholder='아이디']",  # 아이디 입력
        "password_input": "input[placeholder='비밀번호']",  # 비밀번호 입력
        "login_submit": "button:has-text('로그인')",  # 로그인 제출 버튼
        "logout_indicator": "text=/로그아웃|님/",  # 로그인 성공 확인용

        # 주소 검색 (부동산 등기사항증명서)
        "search_input": "input[placeholder*='지번 또는 도로명 주소 입력']",  # 주소 검색 입력
        "search_button": "a:has-text('검색')",  # 검색 버튼
        "result_table": "table",  # 검색 결과 테이블
        "result_checkbox": "input[type='checkbox']",  # 결과 체크박스
        "next_button": "a:has-text('다음')",  # 다음 버튼

        # 발급
        "issue_button": "button:has-text('발급')",  # 발급 신청 버튼
        "confirm_button": "button:has-text('확인')",  # 확인 버튼
        "download_link": "a:has-text('다운로드'), a[href*='download']",  # PDF 다운로드 링크
    }

    def __init__(
        self,
        user_id: str,
        password: str,
        headless: bool = True,
        download_dir: str = "/tmp/registry_downloads",
        timeout: int = 30000,  # 30초
    ):
        """
        Args:
            user_id: 인터넷등기소 아이디
            password: 인터넷등기소 비밀번호
            headless: 헤드리스 모드 사용 여부
            download_dir: PDF 다운로드 디렉토리
            timeout: 기본 타임아웃 (밀리초)
        """
        self.user_id = user_id
        self.password = password
        self.headless = headless
        self.download_dir = Path(download_dir)
        self.timeout = timeout
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.is_logged_in = False

        # 다운로드 디렉토리 생성
        self.download_dir.mkdir(parents=True, exist_ok=True)

    async def __aenter__(self):
        """컨텍스트 매니저 진입"""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """컨텍스트 매니저 종료"""
        await self.close()

    async def start(self):
        """브라우저 시작"""
        logger.info("Playwright 브라우저 시작...")

        playwright = await async_playwright().start()

        # Chromium 브라우저 실행
        self.browser = await playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--disable-blink-features=AutomationControlled",  # 자동화 감지 우회
                "--disable-dev-shm-usage",  # Docker 환경 호환
                "--no-sandbox",  # Docker 환경 호환
            ],
        )

        # 브라우저 컨텍스트 생성 (다운로드 디렉토리 설정)
        self.context = await self.browser.new_context(
            accept_downloads=True,
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )

        # 페이지 생성
        self.page = await self.context.new_page()
        self.page.set_default_timeout(self.timeout)

        logger.info("브라우저 시작 완료")

    async def close(self):
        """브라우저 종료"""
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()

        logger.info("브라우저 종료 완료")

    async def login(self) -> bool:
        """
        인터넷등기소 로그인

        Returns:
            로그인 성공 여부

        Raises:
            RegistryRPAError: 로그인 실패 시
        """
        if not self.page:
            raise RegistryRPAError("브라우저가 시작되지 않았습니다")

        if self.is_logged_in:
            logger.info("이미 로그인된 상태입니다")
            return True

        logger.info("로그인 시작...")

        try:
            # 로그인 페이지로 직접 접속
            # 메인 페이지에서 로그인 링크 클릭하면 자동으로 로그인 페이지로 이동됨
            await self.page.goto(self.IROS_URL, wait_until="domcontentloaded")
            logger.info("인터넷등기소 메인 페이지 로드 완료")

            # 헤더의 로그인 버튼 클릭 (드롭다운 열림)
            await self.page.wait_for_selector(self.SELECTORS["login_button_header"], timeout=5000)
            await self.page.click(self.SELECTORS["login_button_header"])
            await asyncio.sleep(0.5)  # 드롭다운 애니메이션 대기

            # 드롭다운 내 로그인 링크 클릭
            await self.page.locator("#mf_wfm_potal_main_wf_header_wq_uuid_2533").click()
            await self.page.wait_for_load_state("domcontentloaded")
            logger.info("로그인 페이지 열기 완료")

            # 아이디 입력
            await self.page.wait_for_selector(self.SELECTORS["user_id_input"])
            await self.page.fill(self.SELECTORS["user_id_input"], self.user_id)
            logger.info(f"아이디 입력 완료: {self.user_id[:3]}***")

            # 비밀번호 입력
            await self.page.fill(self.SELECTORS["password_input"], self.password)
            logger.info("비밀번호 입력 완료")

            # 로그인 제출 버튼 클릭
            await self.page.click(self.SELECTORS["login_submit"])
            logger.info("로그인 버튼 클릭")

            # 페이지 로드 대기 (로그인 성공 시 리디렉션)
            await self.page.wait_for_load_state("networkidle", timeout=10000)

            # 로그인 성공 확인 (사용자명 + "님" 또는 로그아웃 버튼 확인)
            try:
                await self.page.wait_for_selector(self.SELECTORS["logout_indicator"], timeout=5000)
                self.is_logged_in = True
                logger.info("✅ 로그인 성공")
                return True

            except PlaywrightTimeoutError:
                # 로그인 실패 - 스크린샷 저장
                screenshot_path = self.download_dir / f"login_failed_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                await self.page.screenshot(path=screenshot_path)
                logger.error(f"로그인 실패 스크린샷: {screenshot_path}")
                raise RegistryRPAError("로그인 실패: 로그아웃 버튼을 찾을 수 없습니다")

        except PlaywrightTimeoutError as e:
            logger.error(f"로그인 타임아웃: {e}")
            screenshot_path = self.download_dir / f"login_timeout_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            await self.page.screenshot(path=screenshot_path)
            logger.info(f"타임아웃 스크린샷: {screenshot_path}")
            raise RegistryRPAError(f"로그인 타임아웃: {str(e)}")

        except Exception as e:
            logger.error(f"로그인 실패: {e}")
            screenshot_path = self.download_dir / f"login_error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            await self.page.screenshot(path=screenshot_path)
            logger.info(f"에러 스크린샷: {screenshot_path}")
            raise RegistryRPAError(f"로그인 실패: {str(e)}")

    async def search_address(self, address: str) -> list[Dict[str, Any]]:
        """
        주소 검색

        Args:
            address: 검색할 주소 (예: "서울시 강남구 테헤란로 123")

        Returns:
            검색 결과 목록 [{"text": "주소명", "value": "고유키"}]

        Raises:
            RegistryRPAError: 검색 실패 시
        """
        if not self.page:
            raise RegistryRPAError("브라우저가 시작되지 않았습니다")

        logger.info(f"주소 검색 시작: {address}")

        try:
            # 인터넷등기소 접속
            await self.page.goto(self.IROS_URL, wait_until="domcontentloaded")
            logger.info("인터넷등기소 페이지 로드 완료")

            # 주소 검색 입력
            await self.page.fill(self.SELECTORS["search_input"], address)
            await self.page.click(self.SELECTORS["search_button"])

            # 검색 결과 대기
            await self.page.wait_for_selector(self.SELECTORS["result_item"], timeout=10000)

            # 검색 결과 추출
            results = await self.page.evaluate("""
                () => {
                    const items = document.querySelectorAll('.search-result-item');
                    return Array.from(items).map(item => ({
                        text: item.textContent.trim(),
                        value: item.getAttribute('data-value') || item.id
                    }));
                }
            """)

            logger.info(f"검색 결과 {len(results)}개 발견")
            return results

        except PlaywrightTimeoutError:
            logger.error(f"주소 검색 타임아웃: {address}")
            raise RegistryRPAError(f"주소 검색 타임아웃: {address}")
        except Exception as e:
            logger.error(f"주소 검색 실패: {e}")
            raise RegistryRPAError(f"주소 검색 실패: {str(e)}")

    async def check_login_status(self) -> bool:
        """
        현재 로그인 상태 확인

        Returns:
            로그인 여부
        """
        if not self.page:
            return False

        try:
            # 메인 페이지 접속
            await self.page.goto(self.IROS_URL, wait_until="domcontentloaded")

            # 로그아웃 버튼 또는 사용자명 확인
            logout_element = await self.page.query_selector(self.SELECTORS["logout_indicator"])

            if logout_element:
                self.is_logged_in = True
                logger.info("✅ 이미 로그인되어 있습니다")
                return True
            else:
                self.is_logged_in = False
                logger.info("로그인이 필요합니다")
                return False

        except Exception as e:
            logger.warning(f"로그인 상태 확인 실패: {e}")
            return False

    async def issue_registry(
        self,
        address: str,
        result_index: int = 0,
    ) -> str:
        """
        등기부등본 발급

        Args:
            address: 부동산 주소
            result_index: 검색 결과 중 선택할 인덱스 (기본값: 0)

        Returns:
            다운로드된 PDF 파일 경로

        Raises:
            RegistryRPAError: 발급 실패 시
        """
        if not self.page:
            raise RegistryRPAError("브라우저가 시작되지 않았습니다")

        logger.info(f"등기부등본 발급 시작: {address}")

        # 로그인 상태 확인
        is_logged_in = await self.check_login_status()

        # 로그인이 안되어 있으면 로그인 수행
        if not is_logged_in:
            logger.info("로그인을 먼저 수행합니다")
            await self.login()
        else:
            logger.info("로그인 완료 상태 - 바로 주소 검색 진행")

        try:
            # 1. 주소 검색
            results = await self.search_address(address)

            if not results:
                raise RegistryRPAError(f"검색 결과가 없습니다: {address}")

            if result_index >= len(results):
                raise RegistryRPAError(f"잘못된 결과 인덱스: {result_index} (총 {len(results)}개)")

            # 2. 검색 결과 선택
            logger.info(f"검색 결과 선택: {results[result_index]['text']}")

            result_selector = f"{self.SELECTORS['result_item']}:nth-child({result_index + 1})"
            await self.page.click(result_selector)

            # 3. 발급 신청 버튼 클릭
            await self.page.wait_for_selector(self.SELECTORS["issue_button"])
            await self.page.click(self.SELECTORS["issue_button"])

            logger.info("발급 신청 버튼 클릭 완료")

            # 4. 확인 버튼 클릭 (팝업 등)
            try:
                await self.page.wait_for_selector(self.SELECTORS["confirm_button"], timeout=5000)
                await self.page.click(self.SELECTORS["confirm_button"])
                logger.info("확인 버튼 클릭 완료")
            except PlaywrightTimeoutError:
                logger.debug("확인 버튼 없음 (스킵)")

            # 5. PDF 다운로드 대기
            logger.info("PDF 다운로드 대기 중...")

            async with self.page.expect_download(timeout=60000) as download_info:
                await self.page.click(self.SELECTORS["download_link"])

            download = await download_info.value

            # 6. 파일 저장
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"registry_{timestamp}.pdf"
            save_path = self.download_dir / filename

            await download.save_as(save_path)

            logger.info(f"등기부등본 다운로드 완료: {save_path}")

            return str(save_path)

        except PlaywrightTimeoutError as e:
            logger.error(f"타임아웃 에러: {e}")

            # 스크린샷 저장 (디버깅용)
            screenshot_path = self.download_dir / f"error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
            await self.page.screenshot(path=screenshot_path)
            logger.info(f"에러 스크린샷 저장: {screenshot_path}")

            raise RegistryRPAError(f"등기부등본 발급 타임아웃: {str(e)}")

        except Exception as e:
            logger.error(f"등기부등본 발급 실패: {e}")
            raise RegistryRPAError(f"등기부등본 발급 실패: {str(e)}")

    async def issue_with_retry(
        self,
        address: str,
        result_index: int = 0,
        max_retries: int = 3,
    ) -> str:
        """
        재시도 로직이 포함된 등기부등본 발급

        Args:
            address: 부동산 주소
            result_index: 검색 결과 인덱스
            max_retries: 최대 재시도 횟수

        Returns:
            다운로드된 PDF 파일 경로

        Raises:
            RegistryRPAError: 모든 재시도 실패 시
        """
        for attempt in range(max_retries):
            try:
                logger.info(f"발급 시도 {attempt + 1}/{max_retries}")
                return await self.issue_registry(address, result_index)

            except RegistryRPAError as e:
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 5  # 5초, 10초, 15초...
                    logger.warning(f"발급 실패, {wait_time}초 후 재시도: {e}")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"모든 재시도 실패: {e}")
                    raise


async def issue_registry_pdf(
    address: str,
    user_id: str,
    password: str,
    result_index: int = 0,
    headless: bool = True,
) -> str:
    """
    등기부등본 발급 헬퍼 함수 (편의 함수)

    Args:
        address: 부동산 주소
        user_id: 인터넷등기소 아이디
        password: 인터넷등기소 비밀번호
        result_index: 검색 결과 인덱스
        headless: 헤드리스 모드 사용 여부

    Returns:
        다운로드된 PDF 파일 경로

    Example:
        >>> pdf_path = await issue_registry_pdf(
        ...     "서울시 강남구 테헤란로 123",
        ...     "myid",
        ...     "mypassword"
        ... )
        >>> print(f"PDF 저장 위치: {pdf_path}")
    """
    async with RegistryRPA(user_id, password, headless=headless) as rpa:
        return await rpa.issue_with_retry(address, result_index)


# 테스트 코드
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    async def test():
        """RPA 테스트"""
        test_address = "서울특별시 강남구 테헤란로 123"

        try:
            pdf_path = await issue_registry_pdf(test_address, headless=False)
            print(f"✅ 등기부등본 발급 성공: {pdf_path}")
        except RegistryRPAError as e:
            print(f"❌ 등기부등본 발급 실패: {e}")

    asyncio.run(test())

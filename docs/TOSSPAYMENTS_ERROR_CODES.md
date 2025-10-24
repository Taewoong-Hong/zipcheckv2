# 토스페이먼츠 에러 코드 정리

## 결제위젯 에러

| 코드 | 메시지 |
|------|--------|
| `AGREEMENT_WIDGET_ALREADY_RENDERED` | 하나의 약관 위젯만을 사용할 수 있어요. |
| `BELOW_ZERO_AMOUNT` | 금액은 0보다 커야 합니다. |
| `CUSTOM_PAYMENT_METHOD_UNABLE_TO_PAY` | 커스텀 결제수단으로 결제할 수 없습니다. |
| `EXCEED_DEPOSIT_AMOUNT_LIMIT` | 가상계좌 입금 제한 금액을 초과했어요. 다른 결제수단을 이용해주세요. |
| `EXCEED_MAX_DUE_DATE` | 가상 계좌의 최대 유효만료 기간을 초과했습니다. |
| `INCORRECT_FAIL_URL_FORMAT` | 잘못된 failUrl 입니다. |
| `INCORRECT_SUCCESS_URL_FORMAT` | 잘못된 successUrl 입니다. |
| `INVALID_AMOUNT_CURRENCY` | 잘못된 통화 값입니다. |
| `INVALID_AMOUNT_VALUE` | 결제금액이 올바르지 않습니다. |
| `INVALID_PARAMETER` | 콜백 함수가 올바르지 않습니다. |
| `INVALID_CLIENT_KEY` | ClientKey 형태가 올바르지 않습니다. |
| `INVALID_CUSTOMER_KEY` | 고객키는 영문 대소문자, 숫자, 특수문자 -, _, =, ., @로 2자 이상 50자 이하여야 합니다. |
| `INVALID_PARAMETER` | 허용하지 않는 이벤트입니다. |
| `INVALID_METHOD_TRANSACTION` | 이미 다른 요청을 수행하고 있어요. |
| `INVALID_PARAMETERS` | 필수 파라미터를 누락하거나, 정의되지 않은 파라미터를 추가하거나, 파라미터의 타입이 올바르지 않을 때 발생합니다. |
| `INVALID_SELECTOR` | selector에 해당하는 HTML 요소를 찾을 수 없습니다. selector 값을 다시 확인해주세요. |
| `INVALID_VARIANT_KEY` | variantKey 에 해당하는 위젯을 찾을 수 없습니다. variantKey 값을 다시 확인해주세요. |
| `NEED_AGREEMENT_WITH_REQUIRED_TERMS` | 필수 약관에 동의해주세요. |
| `NEED_CARD_PAYMENT_DETAIL` | 카드 결제 정보를 선택해주세요. |
| `NEED_REFUND_ACCOUNT_DETAIL` | 환불계좌 정보를 모두 입력해주세요. |
| `NOT_SELECTED_PAYMENT_METHOD` | 결제수단이 아직 선택되지 않았어요. 결제수단을 선택해 주세요. |
| `NOT_SETUP_AMOUNT` | 결제금액이 설정되지 않았습니다. setAmount를 호출해주세요. |
| `NOT_SUPPORTED_PROMISE` | Promise 방식을 지원하지 않습니다. successUrl, failUrl을 사용해주세요. |
| `PAYMENT_METHODS_WIDGET_ALREADY_RENDERED` | 하나의 결제수단 위젯만을 사용할 수 있어요. |
| `PROVIDER_STATUS_UNHEALTHY` | 결제 기관(카드사, 은행, 국세청 등) 오류입니다. 다른 결제수단을 선택해 주세요. |
| `UNKNOWN` | 알 수 없는 에러가 발생했습니다. |
| `UNSUPPORTED_TEST_PHASE_PAYMENT_METHOD` | 테스트 환경을 지원하지 않는 결제수단입니다. |
| `USER_CANCEL` | 취소되었습니다. |
| `V1_METHOD_NOT_SUPPORTED` | 해당 API 는 v1 에서만 제공됩니다. |
| `INSECURE_KEY_USAGE` | test_gsk, live_gsk로 시작하는 시크릿 키는 클라이언트 코드에 노출되면 안 됩니다. 구매자를 식별하는 customerKey 값을 사용해주세요. |
| `INVALID_METADATA` | 올바르지 않은 metadata 형식입니다. |
| `NOT_SUPPORTED_API_INDIVIDUAL_KEY` | 결제위젯 연동 키의 클라이언트 키로 SDK를 연동해주세요. API 개별 연동 키는 지원하지 않습니다. |

## 브랜드페이 에러

| 코드 | 메시지 |
|------|--------|
| `BELOW_ZERO_AMOUNT` | 금액은 0보다 커야 합니다. |
| `INCORRECT_FAIL_URL_FORMAT` | 잘못된 failUrl 입니다. |
| `INCORRECT_SUCCESS_URL_FORMAT` | 잘못된 successUrl 입니다. |
| `INVALID_AMOUNT_VALUE` | 결제금액이 올바르지 않습니다. |
| `INVALID_CLIENT_KEY` | ClientKey 형태가 올바르지 않습니다. |
| `INVALID_CUSTOMER_KEY` | 고객키는 영문 대소문자, 숫자, 특수문자 -, _, =, ., @로 2자 이상 50자 이하여야 합니다. |
| `INVALID_METHOD_TRANSACTION` | 이미 다른 요청을 수행하고 있어요. |
| `INVALID_PARAMETERS` | 필수 파라미터를 누락하거나, 정의되지 않은 파라미터를 추가하거나, 파라미터의 타입이 올바르지 않을 때 발생합니다. |
| `NEED_AGREEMENT_WITH_TERMS` | 이용약관 동의가 필요합니다. |
| `NEED_MERCHANT_ONE_TOUCH_SETTING` | 원터치결제 사용을 위해서는 가맹점 설정이 필요합니다. |
| `UNKNOWN` | 알 수 없는 에러가 발생했습니다. |
| `USER_CANCEL` | 취소되었습니다. |
| `V1_METHOD_NOT_SUPPORTED` | 해당 API 는 v1 에서만 제공됩니다. |
| `NOT_REGISTERED_REDIRECT_URL` | 리다이렉트 URL이 등록되지 않았습니다. 개발정보 페이지에서 등록해주세요. https://developers.tosspayments.com/my/brandpay |
| `INSECURE_KEY_USAGE` | test_gsk, live_gsk로 시작하는 시크릿 키는 클라이언트 코드에 노출되면 안 됩니다. 구매자를 식별하는 customerKey 값을 사용해주세요. |
| `INVALID_METADATA` | 올바르지 않은 metadata 형식입니다. |
| `NOT_SUPPORTED_WIDGET_KEY` | API 개별 연동 키의 클라이언트 키로 SDK를 연동해주세요. 결제위젯 연동 키는 지원하지 않습니다. |

## 결제창 에러

| 코드 | 메시지 |
|------|--------|
| `BELOW_ZERO_AMOUNT` | 금액은 0보다 커야 합니다. |
| `INCORRECT_FAIL_URL_FORMAT` | 잘못된 failUrl 입니다. |
| `INCORRECT_SUCCESS_URL_FORMAT` | 잘못된 successUrl 입니다. |
| `INVALID_AMOUNT_CURRENCY` | 잘못된 통화 값입니다. |
| `INVALID_AMOUNT_VALUE` | 결제금액이 올바르지 않습니다. |
| `INVALID_CLIENT_KEY` | ClientKey 형태가 올바르지 않습니다. |
| `INVALID_CUSTOMER_KEY` | 고객키는 영문 대소문자, 숫자, 특수문자 -, _, =, ., @로 2자 이상 50자 이하여야 합니다. |
| `INVALID_METHOD_TRANSACTION` | 이미 다른 요청을 수행하고 있어요. |
| `INVALID_PARAMETERS` | 필수 파라미터를 누락하거나, 정의되지 않은 파라미터를 추가하거나, 파라미터의 타입이 올바르지 않을 때 발생합니다. |
| `NOT_SUPPORTED_METHOD` | 지원되지 않는 결제수단입니다. |
| `NOT_SUPPORTED_PROMISE` | Promise 방식을 지원하지 않습니다. successUrl, failUrl을 사용해주세요. |
| `UNKNOWN` | 알 수 없는 에러가 발생했습니다. |
| `USER_CANCEL` | 취소되었습니다. |
| `V1_METHOD_NOT_SUPPORTED` | 해당 API 는 v1 에서만 제공됩니다. |
| `INSECURE_KEY_USAGE` | test_gsk, live_gsk로 시작하는 시크릿 키는 클라이언트 코드에 노출되면 안 됩니다. 구매자를 식별하는 customerKey 값을 사용해주세요. |
| `INVALID_METADATA` | 올바르지 않은 metadata 형식입니다. |
| `NOT_SUPPORTED_WIDGET_KEY` | API 개별 연동 키의 클라이언트 키로 SDK를 연동해주세요. 결제위젯 연동 키는 지원하지 않습니다. |

## failUrl로 전달되는 에러

### 결제위젯/결제창 공통

결제위젯, 결제창의 `requestPayment()` 메서드로 결제 요청에 실패했을 때 failUrl로 전달되는 에러입니다.

| 에러 코드 | 한글 메시지 | 영문 메시지 |
|-----------|-------------|-------------|
| `PAY_PROCESS_CANCELED` | 사용자에 의해 결제가 취소되었습니다. | Payment has been canceled by the customer. |
| `PAY_PROCESS_ABORTED` | 결제 진행 중 승인에 실패하여 결제가 중단되었습니다. | Payment has been canceled or has not been processed. |
| `REJECT_CARD_COMPANY` | 결제 승인이 거절되었습니다. | Payment was rejected. |

### 브랜드페이 전용

브랜드페이의 `requestPayment()` 메서드로 결제 요청에 실패했을 때 failUrl로 전달되는 에러입니다.

| 에러 코드 | 한글 메시지 | 영문 메시지 |
|-----------|-------------|-------------|
| `FAILED_CARD_COMPANY` | 카드사 점검 중으로 다른 카드를 이용해 주세요. | Please use another card while checking the credit card company system. |
| `MAINTAINED_METHOD` | 현재 점검 중 입니다. | Under maintenance. |
| `INVALID_STOPPED_CARD` | 정지된 카드 입니다. | This is a suspended card. |
| `INVALID_CARD_INFO_RE_REGISTER` | 유효하지 않은 카드입니다. 카드 재등록 후 시도해주세요. | Invalid card. Please re-register the card and try again. |
| `INVALID_CARD_LOST_OR_STOLEN` | 분실 혹은 도난 카드입니다. | This is a lost or stolen card |
| `DUPLICATED_ORDER_ID` | 이미 승인 및 취소가 진행된 중복된 주문번호 입니다. 다른 주문번호로 진행해주세요. | This is a duplicate order id that has already been approved or canceled. Please proceed with a different order id. |
| `NOT_ALLOWED_BRANDPAY_METHOD` | 삭제된 결제 수단이거나 가맹점에서 사용이 불가능한 결제 수단입니다. | The payment method has been deleted or cannot be used by the merchant. |
| `NOT_FOUND_METHOD` | 존재하지 않는 결제 수단 입니다. | Not found payment method |
| `INVALID_REQUEST` | 잘못된 요청입니다. | The bad request. |
| `NOT_SUPPORTED_METHOD` | 지원되지 않는 결제 수단입니다. | This payment method is not supported. |
| `INVALID_PASSWORD` | 결제 비밀번호가 일치하지 않습니다. | Incorrect password |
| `NOT_FOUND_CUSTOMER` | 유효한 고객 정보가 없습니다. | There is no valid customer information. |
| `FAILED_DB_PROCESSING` | 잘못된 요청 값으로 처리 중 DB 에러가 발생했습니다. | A DB error occurred while processing with an invalid request value. |
| `NOT_FOUND_METHOD_OWNERSHIP` | 결제수단의 소유자가 아닙니다. | Not found method ownership |
| `NOT_FOUND_MERCHANT` | 존재하지 않는 상점 정보 입니다. | Not found merchant id |
| `UNKNOWN_PAYMENT_ERROR` | 결제에 실패했어요. 같은 문제가 반복된다면 은행이나 카드사로 문의해주세요. | Payment failed. If the same problem occurs, please contact your bank or credit card company. |
| `RESTRICTED_TRANSFER_ACCOUNT` | 계좌는 등록 후 12시간 뒤부터 결제할 수 있습니다. 관련 정책은 해당 은행으로 문의해주세요. | You can withdraw from this bank account after 12 hours from initial register. For related policies, please contact your bank. |
| `FORBIDDEN_DORMANT_OR_WITHDRAWAL_CUSTOMER` | 휴면고객이거나 탈퇴한 고객입니다. | You are a dormant customer or a member who has been withdrawn. |
| `FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING` | 결제가 완료되지 않았어요. 다시 시도해주세요. | Payment has not been completed. please try again. |
| `COMMON_ERROR` | 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요. | This is temporary error. Please try again in a few minutes. |
| `INVALID_MAXIMUM_DISCOUNT_AMOUNT` | 할인 적용 시 최대 금액을 넘으면 안 됩니다. | The maximum amount must not exceeded to apply the discount. |
| `NOT_FOUND_PAYMENT` | 존재하지 않는 결제 정보 입니다. | Not found payment |
| `INVALID_REQUIRED_PARAM` | 필수 파라미터가 누락되었습니다. | The required parameter is missing. |
| `SUSPECTED_PHISHING_PAYMENT` | 결제에 실패했습니다. 피싱사고 의심 거래입니다. | Payment rejected due to suspected phishing scam. |
| `EXCEED_MAX_DISCOUNT_COUNT` | 즉시 할인이 가능한 회수를 초과했습니다. | You have exceeded the number of times available for discount promotion. |

## 주요 에러 처리 가이드

### 1. 클라이언트 측에서 처리해야 할 에러
- `INVALID_CUSTOMER_KEY`: customerKey 형식 검증 (2-50자, 영문 대소문자, 숫자, -, _, =, ., @)
- `INVALID_AMOUNT_VALUE`: 결제 금액이 0보다 큰지 검증
- `INCORRECT_SUCCESS_URL_FORMAT`, `INCORRECT_FAIL_URL_FORMAT`: URL 형식 검증
- `INVALID_PARAMETERS`: 필수 파라미터 누락 여부 확인

### 2. 사용자 안내가 필요한 에러
- `USER_CANCEL`: 사용자가 결제를 취소한 경우
- `PROVIDER_STATUS_UNHEALTHY`: 카드사/은행 시스템 장애 안내
- `REJECT_CARD_COMPANY`: 카드사 승인 거절 안내
- `PAY_PROCESS_CANCELED`: 사용자 취소 확인 메시지

### 3. 재시도 가능한 에러
- `COMMON_ERROR`: 일시적 오류, 잠시 후 재시도 권장
- `FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING`: 결제 미완료, 재시도 권장
- `INVALID_METHOD_TRANSACTION`: 이미 다른 요청 수행 중, 잠시 후 재시도

### 4. 보안 관련 에러
- `INSECURE_KEY_USAGE`: 시크릿 키 클라이언트 노출 방지
- `SUSPECTED_PHISHING_PAYMENT`: 피싱 의심 거래 차단

### 5. 개발자 설정 필요 에러
- `NOT_REGISTERED_REDIRECT_URL`: 리다이렉트 URL 등록 필요
- `NOT_SUPPORTED_API_INDIVIDUAL_KEY`, `NOT_SUPPORTED_WIDGET_KEY`: 올바른 연동 키 사용 필요

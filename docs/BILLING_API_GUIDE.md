# 토스페이먼츠 빌링(자동결제) API 가이드

## 🔄 빌링 시스템 플로우

```
1. 사용자가 체크아웃 페이지에서 카드 정보 입력 (결제위젯)
   ↓
2. "구독 시작하기" 클릭 → 첫 결제 + 빌링키 발급
   ↓
3. /checkout/success로 리디렉션 (paymentKey, orderId, amount 포함)
   ↓
4. 백엔드에서 결제 승인 API 호출 → 빌링키 저장
   ↓
5. 이후 매월/매년 자동으로 빌링키로 결제
```

## 📋 필요한 백엔드 API 엔드포인트

### 1. 결제 승인 및 빌링키 저장 API

**엔드포인트**: `POST /api/payments/confirm`

**요청 Body**:
```json
{
  "paymentKey": "tviva20241023135713hH8Fq",
  "orderId": "ORDER_1729657033847",
  "amount": 94800,
  "customerEmail": "user@example.com",
  "customerName": "홍길동",
  "plan": "personal",
  "billingCycle": "yearly"
}
```

**처리 로직**:
```typescript
// 1. 토스페이먼츠 결제 승인 API 호출
const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
  method: "POST",
  headers: {
    "Authorization": `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    paymentKey,
    orderId,
    amount,
  }),
});

const payment = await response.json();

// 2. 빌링키 추출 (카드 결제인 경우)
const billingKey = payment.card?.billingKey;

// 3. 데이터베이스에 저장
await db.subscriptions.create({
  userId: user.id,
  plan: "personal",
  billingCycle: "yearly",
  billingKey: billingKey,
  nextBillingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년 후
  status: "active",
  amount: 94800,
});

// 4. 결제 내역 저장
await db.payments.create({
  userId: user.id,
  orderId: orderId,
  paymentKey: paymentKey,
  amount: amount,
  status: "completed",
  paidAt: new Date(),
});
```

**응답**:
```json
{
  "success": true,
  "subscription": {
    "id": "sub_123",
    "plan": "personal",
    "billingCycle": "yearly",
    "nextBillingDate": "2025-10-23",
    "status": "active"
  }
}
```

### 2. 빌링키로 자동 결제 API (Cron Job)

**엔드포인트**: `POST /api/payments/billing/auto`

**처리 로직**:
```typescript
// 1. 오늘 결제할 구독 조회
const subscriptions = await db.subscriptions.findMany({
  where: {
    status: "active",
    nextBillingDate: {
      lte: new Date(),
    },
  },
});

// 2. 각 구독에 대해 빌링키로 결제
for (const sub of subscriptions) {
  try {
    // 빌링키 결제 API 호출
    const response = await fetch("https://api.tosspayments.com/v1/billing/{billingKey}", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(secretKey + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerKey: sub.customerKey,
        amount: sub.amount,
        orderId: `AUTO_${Date.now()}_${sub.id}`,
        orderName: `${sub.plan} - ${sub.billingCycle} 자동결제`,
        customerEmail: sub.user.email,
        customerName: sub.user.name,
      }),
    });

    const payment = await response.json();

    if (payment.status === "DONE") {
      // 결제 성공 → 다음 결제일 업데이트
      const nextDate = sub.billingCycle === "monthly"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      await db.subscriptions.update({
        where: { id: sub.id },
        data: { nextBillingDate: nextDate },
      });

      // 결제 내역 저장
      await db.payments.create({
        userId: sub.userId,
        subscriptionId: sub.id,
        orderId: payment.orderId,
        paymentKey: payment.paymentKey,
        amount: payment.totalAmount,
        status: "completed",
        paidAt: new Date(),
      });

      // 이메일 알림 발송
      await sendEmail({
        to: sub.user.email,
        subject: "집체크 구독 결제 완료",
        body: `${sub.plan} 플랜이 자동으로 결제되었습니다.`,
      });
    } else {
      // 결제 실패 처리
      await handlePaymentFailure(sub);
    }
  } catch (error) {
    console.error(`구독 ${sub.id} 자동결제 실패:`, error);
    await handlePaymentFailure(sub);
  }
}
```

### 3. 구독 취소 API

**엔드포인트**: `POST /api/subscriptions/cancel`

**요청 Body**:
```json
{
  "subscriptionId": "sub_123",
  "reason": "서비스 불만족"
}
```

**처리 로직**:
```typescript
// 1. 구독 상태 변경
await db.subscriptions.update({
  where: { id: subscriptionId },
  data: {
    status: "canceled",
    canceledAt: new Date(),
    cancelReason: reason,
  },
});

// 2. 빌링키 삭제 (옵션)
// 토스페이먼츠에서는 자동으로 만료되므로 선택사항

// 3. 취소 확인 이메일 발송
await sendEmail({
  to: user.email,
  subject: "집체크 구독 취소 완료",
  body: "구독이 취소되었습니다. 다음 결제일까지 서비스를 이용하실 수 있습니다.",
});
```

## 🗄️ 데이터베이스 스키마

### subscriptions 테이블
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  plan VARCHAR(50) NOT NULL, -- 'personal' or 'pro'
  billing_cycle VARCHAR(20) NOT NULL, -- 'monthly' or 'yearly'
  billing_key VARCHAR(255) NOT NULL, -- 토스페이먼츠 빌링키
  customer_key VARCHAR(255) NOT NULL, -- 토스페이먼츠 고객키
  amount INTEGER NOT NULL, -- 결제 금액
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'suspended'
  next_billing_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  canceled_at TIMESTAMP,
  cancel_reason TEXT
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date) WHERE status = 'active';
```

### payments 테이블
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  order_id VARCHAR(255) NOT NULL UNIQUE,
  payment_key VARCHAR(255) NOT NULL,
  amount INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'completed', 'failed', 'refunded'
  payment_method VARCHAR(50), -- 'card', 'virtual_account', etc.
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
```

## 🔐 토스페이먼츠 API 키

### 테스트 환경
```bash
# 결제위젯용 클라이언트 키
TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm

# API 호출용 시크릿 키 (백엔드에서만 사용)
TOSS_SECRET_KEY=test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R
```

### 프로덕션 환경
```bash
# 실제 서비스 배포 시 발급받아야 함
TOSS_CLIENT_KEY=live_gck_...
TOSS_SECRET_KEY=live_sk_...
```

## 📝 자동결제 실패 처리

### 재시도 로직
```typescript
async function handlePaymentFailure(subscription: Subscription) {
  // 재시도 횟수 증가
  const retryCount = subscription.retryCount + 1;

  if (retryCount < 3) {
    // 3회 미만: 3일 후 재시도
    await db.subscriptions.update({
      where: { id: subscription.id },
      data: {
        retryCount: retryCount,
        nextBillingDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    // 결제 실패 알림 이메일
    await sendEmail({
      to: subscription.user.email,
      subject: "집체크 구독 결제 실패",
      body: "결제에 실패했습니다. 3일 후 재시도됩니다. 카드 정보를 확인해주세요.",
    });
  } else {
    // 3회 이상 실패: 구독 일시정지
    await db.subscriptions.update({
      where: { id: subscription.id },
      data: {
        status: "suspended",
        suspendedAt: new Date(),
      },
    });

    // 구독 정지 알림
    await sendEmail({
      to: subscription.user.email,
      subject: "집체크 구독 일시정지",
      body: "결제가 3회 실패하여 구독이 일시정지되었습니다. 결제 정보를 업데이트해주세요.",
    });
  }
}
```

## 🚀 Cron Job 설정

### Vercel Cron (Next.js)
```typescript
// app/api/cron/billing/route.ts
export async function GET(request: Request) {
  // Vercel Cron Secret 검증
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 자동결제 실행
  await runAutoBilling();

  return Response.json({ success: true });
}
```

### vercel.json
```json
{
  "crons": [{
    "path": "/api/cron/billing",
    "schedule": "0 2 * * *"
  }]
}
```

## 📧 이메일 알림

### 결제 성공
- 제목: "집체크 구독 결제 완료"
- 내용: 결제 금액, 다음 결제일, 영수증 링크

### 결제 실패
- 제목: "집체크 구독 결제 실패"
- 내용: 실패 사유, 재시도 일정, 결제 정보 업데이트 링크

### 구독 만료 예정
- 제목: "집체크 구독 갱신 안내"
- 내용: 3일 전 갱신 예정 알림

## 🔍 테스트 카드 번호

토스페이먼츠 테스트 환경에서 사용 가능한 카드:
- **성공**: 4300-0000-0000-0001 (모든 카드사)
- **잔액 부족**: 4300-0000-0000-0002
- **한도 초과**: 4300-0000-0000-0003
- **정지 카드**: 4300-0000-0000-0004

## 📚 참고 문서

- [토스페이먼츠 빌링 가이드](https://docs.tosspayments.com/guides/billing)
- [결제위젯 API](https://docs.tosspayments.com/reference/widget-sdk)
- [빌링키 발급 API](https://docs.tosspayments.com/reference#%EB%B9%8C%EB%A7%81%ED%82%A4-%EB%B0%9C%EA%B8%89)
- [자동결제 API](https://docs.tosspayments.com/reference#%EB%B9%8C%EB%A7%81%ED%82%A4%EB%A1%9C-%EA%B2%B0%EC%A0%9C)

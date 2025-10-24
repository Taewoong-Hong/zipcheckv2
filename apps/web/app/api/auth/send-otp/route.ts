import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

// ✅ 환경 변수 검증 및 초기화 (lazy initialization)
let resend: Resend | null = null;
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

function getSupabaseAdmin(): ReturnType<typeof createClient> {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment variables are not set");
    }

    // ✅ 보안 개선: Anon Key 사용 (RLS 적용)
    supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

// 6자리 랜덤 OTP 생성
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const { email, purpose } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "이메일이 필요합니다." },
        { status: 400 }
      );
    }

    if (!purpose || !["login", "signup"].includes(purpose)) {
      return NextResponse.json(
        { error: "용도(purpose)는 'login' 또는 'signup'이어야 합니다." },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "유효하지 않은 이메일 형식입니다." },
        { status: 400 }
      );
    }

    // OTP 생성
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 후

    const supabase = getSupabaseAdmin();

    // 기존 미사용 OTP 삭제 (같은 이메일, 같은 용도)
    await (supabase
      .from("otp_codes") as any)
      .delete()
      .eq("email", email)
      .eq("purpose", purpose)
      .eq("verified", false);

    // 새 OTP 저장
    const { error: insertError } = await (supabase
      .from("otp_codes") as any)
      .insert({
        email,
        code,
        purpose,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("OTP 저장 오류:", insertError);
      return NextResponse.json(
        { error: "OTP 생성 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    // 이메일 전송
    try {
      const resendClient = getResend();
      const subject = purpose === "login" ? "집체크 로그인 인증 코드" : "집체크 회원가입 인증 코드";
      const message = purpose === "login"
        ? "로그인을 완료하려면 아래 인증 코드를 입력하세요."
        : "회원가입을 완료하려면 아래 인증 코드를 입력하세요.";

      await resendClient.emails.send({
        from: "ZipCheck <onboarding@resend.dev>", // TODO: 도메인 인증 후 변경
        to: email,
        subject,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  color: #333;
                }
                .container {
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 40px 20px;
                }
                .header {
                  text-align: center;
                  margin-bottom: 40px;
                }
                .logo {
                  font-size: 32px;
                  font-weight: bold;
                  color: #D32F2F;
                }
                .content {
                  background: #f9f9f9;
                  border-radius: 8px;
                  padding: 30px;
                  text-align: center;
                }
                .code {
                  font-size: 48px;
                  font-weight: bold;
                  letter-spacing: 8px;
                  color: #D32F2F;
                  margin: 30px 0;
                  padding: 20px;
                  background: white;
                  border-radius: 8px;
                  border: 2px dashed #D32F2F;
                }
                .footer {
                  margin-top: 30px;
                  text-align: center;
                  font-size: 14px;
                  color: #666;
                }
                .warning {
                  margin-top: 20px;
                  padding: 15px;
                  background: #fff3cd;
                  border-radius: 4px;
                  font-size: 14px;
                  color: #856404;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">🏠 집체크</div>
                </div>
                <div class="content">
                  <h2>${subject}</h2>
                  <p>${message}</p>
                  <div class="code">${code}</div>
                  <p style="color: #666; font-size: 14px;">
                    이 코드는 <strong>5분간</strong> 유효합니다.
                  </p>
                </div>
                <div class="warning">
                  ⚠️ 본인이 요청하지 않았다면 이 이메일을 무시하세요.
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} ZipCheck. All rights reserved.</p>
                  <p>더 스마트한 홈딜</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      return NextResponse.json({
        success: true,
        message: "인증 코드가 이메일로 전송되었습니다.",
        expiresAt: expiresAt.toISOString(),
      });
    } catch (emailError) {
      console.error("이메일 전송 오류:", emailError);
      return NextResponse.json(
        { error: "이메일 전송 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("OTP 전송 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

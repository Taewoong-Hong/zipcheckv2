import { NextRequest, NextResponse } from "next/server";

/**
 * 이메일 중복 확인 API
 *
 * ⚠️ 보안 개선: 이메일 존재 여부를 직접 노출하지 않음
 * 대신 회원가입 시도 시 Supabase가 자동으로 처리하도록 함
 *
 * 이유:
 * 1. 이메일 존재 여부 노출은 보안 취약점 (이메일 수집 가능)
 * 2. GDPR/개인정보보호법 위반 가능성
 * 3. Supabase signUp이 자동으로 중복 체크 수행
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "이메일이 필요합니다." },
        { status: 400 }
      );
    }

    // 이메일 형식 검증만 수행
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { valid: false, error: "유효하지 않은 이메일 형식입니다." },
        { status: 200 }
      );
    }

    // ✅ 보안 개선: 이메일 형식만 검증하고, 존재 여부는 노출하지 않음
    // 실제 중복 확인은 회원가입 시도 시 Supabase가 처리
    return NextResponse.json({
      valid: true,
      message: "유효한 이메일 형식입니다."
    });

  } catch (error) {
    console.error("이메일 확인 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ✅ 보안 개선: Anon Key 사용 (RLS 적용)
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase(): ReturnType<typeof createClient> {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment variables are not set");
    }

    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
}

export async function POST(request: NextRequest) {
  try {
    const { email, code, purpose } = await request.json();

    if (!email || !code || !purpose) {
      return NextResponse.json(
        { error: "이메일, 인증 코드, 용도가 모두 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // OTP 조회
    const { data: otpData, error: otpError } = await (supabase
      .from("otp_codes") as any)
      .select("*")
      .eq("email", email)
      .eq("code", code)
      .eq("purpose", purpose)
      .eq("verified", false)
      .single();

    if (otpError || !otpData) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 인증 코드입니다." },
        { status: 400 }
      );
    }

    // 만료 확인
    const now = new Date();
    const expiresAt = new Date(otpData.expires_at);

    if (now > expiresAt) {
      return NextResponse.json(
        { success: false, error: "인증 코드가 만료되었습니다." },
        { status: 400 }
      );
    }

    // OTP 검증 완료 표시
    await (supabase
      .from("otp_codes") as any)
      .update({ verified: true, updated_at: new Date().toISOString() })
      .eq("id", otpData.id);

    // ✅ 보안 개선: OTP 검증만 수행
    // 실제 로그인/회원가입은 클라이언트에서 Supabase Auth를 통해 처리
    return NextResponse.json({
      success: true,
      action: purpose,
      message: "인증이 완료되었습니다.",
      verified: true,
      email: email,
    });
  } catch (error) {
    console.error("OTP 검증 오류:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

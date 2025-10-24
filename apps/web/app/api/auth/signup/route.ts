import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ✅ 보안 개선: Anon Key 사용 (RLS 적용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호가 필요합니다." },
        { status: 400 }
      );
    }

    // 비밀번호 강도 검증 (최소 8자, 영문+숫자 포함)
    if (password.length < 8) {
      return NextResponse.json(
        { error: "비밀번호는 최소 8자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLetter || !hasNumber) {
      return NextResponse.json(
        { error: "비밀번호는 영문과 숫자를 모두 포함해야 합니다." },
        { status: 400 }
      );
    }

    // ✅ 회원가입 (Supabase Auth - signUp 사용)
    // Note: 이메일 중복 확인은 Supabase가 자동으로 처리
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || null,
        },
        // 이메일 인증 필요 (Supabase 설정에 따라 다름)
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (error) {
      console.error("회원가입 오류:", error);

      let errorMessage = "회원가입 중 오류가 발생했습니다.";
      if (error.message.includes("already registered") || error.message.includes("User already registered")) {
        errorMessage = "이미 가입된 이메일입니다.";
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      );
    }

    // 회원가입 성공
    return NextResponse.json({
      success: true,
      message: "회원가입이 완료되었습니다. 이메일을 확인해주세요.",
      user: {
        id: data.user?.id,
        email: data.user?.email,
        user_metadata: data.user?.user_metadata,
      },
    });
  } catch (error) {
    console.error("회원가입 오류:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

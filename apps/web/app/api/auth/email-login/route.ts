import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호가 필요합니다." },
        { status: 400 }
      );
    }

    // Supabase 클라이언트 생성 (클라이언트 키 사용)
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 이메일/비밀번호로 로그인
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("로그인 오류:", error);

      // 에러 메시지 한글화
      let errorMessage = "로그인에 실패했습니다.";
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "이메일 인증이 완료되지 않았습니다.";
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 401 }
      );
    }

    // 로그인 성공
    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
        app_metadata: data.user.app_metadata,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    console.error("이메일 로그인 오류:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

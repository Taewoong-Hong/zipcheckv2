"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");

  const [email, setEmail] = useState(emailParam || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isVerifyingSMS, setIsVerifyingSMS] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [smsSentAt, setSmsSentAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState(180); // 3분 = 180초
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // SMS 타이머
  useEffect(() => {
    if (smsSentAt && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setSmsSentAt(null);
            return 180;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [smsSentAt, timeLeft]);

  // SMS 인증번호 발송
  const handleSendSMS = async () => {
    if (!phone) {
      setError("전화번호를 입력해주세요.");
      return;
    }

    // 전화번호 형식 검증
    const phoneRegex = /^01[0-9]{8,9}$/;
    const cleanPhone = phone.replace(/-/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      setError("올바른 전화번호 형식이 아닙니다 (010-XXXX-XXXX).");
      return;
    }

    setIsSendingSMS(true);
    setError("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "SMS 발송에 실패했습니다.");
      }

      setSmsSentAt(new Date());
      setTimeLeft(180);
      alert("인증번호가 발송되었습니다.");
    } catch (err: any) {
      setError(err.message || "SMS 발송 중 오류가 발생했습니다.");
    } finally {
      setIsSendingSMS(false);
    }
  };

  // SMS 인증번호 확인
  const handleVerifySMS = async () => {
    if (!verificationCode) {
      setError("인증번호를 입력해주세요.");
      return;
    }

    setIsVerifyingSMS(true);
    setError("");

    try {
      const cleanPhone = phone.replace(/-/g, "");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/verify-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "인증에 실패했습니다.");
      }

      setIsPhoneVerified(true);
      setSmsSentAt(null);
      alert("인증이 완료되었습니다!");
    } catch (err: any) {
      setError(err.message || "인증 확인 중 오류가 발생했습니다.");
    } finally {
      setIsVerifyingSMS(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검사
    if (!email || !password || !confirmPassword || !phone) {
      setError("모든 필수 필드를 입력해주세요.");
      return;
    }

    // 전화번호 인증 확인
    if (!isPhoneVerified) {
      setError("전화번호 인증을 완료해주세요.");
      return;
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    // 비밀번호 일치 확인
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    // 비밀번호 강도 검사
    if (password.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasLetter || !hasNumber) {
      setError("비밀번호는 영문과 숫자를 모두 포함해야 합니다.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Supabase Auth 회원가입
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || null,
            phone: phone.replace(/-/g, ""),  // 전화번호 저장 (하이픈 제거)
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        console.error("회원가입 에러:", signUpError);

        if (signUpError.message.includes("already registered") || signUpError.message.includes("User already registered")) {
          setError("이미 가입된 이메일입니다. 로그인 페이지로 이동해주세요.");
        } else {
          setError("회원가입에 실패했습니다. 다시 시도해주세요.");
        }
        return;
      }

      if (data?.user) {
        console.log("회원가입 성공:", data.user.email);
        setSuccess(true);

        // 이메일 인증이 필요한 경우 안내
        if (data.user.identities && data.user.identities.length === 0) {
          setError("이미 가입된 이메일입니다.");
          return;
        }

        // 3초 후 홈으로 리다이렉트
        setTimeout(() => {
          router.push("/");
        }, 3000);
      }
    } catch (err) {
      console.error("회원가입 처리 오류:", err);
      setError("회원가입 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-8">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block mb-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
              집체크
            </h1>
          </Link>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            회원가입
          </h2>
          <p className="text-sm text-neutral-600">
            계약서 분석, 파일 업로드 등 다양한 기능을 이용하세요.
          </p>
        </div>

        {/* 회원가입 완료 메시지 */}
        {success ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600 text-center">
                ✅ 회원가입이 완료되었습니다!
                <br />
                <span className="text-xs mt-2 block">
                  이메일 인증이 필요할 수 있습니다. 이메일을 확인해주세요.
                </span>
              </p>
            </div>
            <p className="text-sm text-neutral-600 text-center">
              잠시 후 홈 페이지로 이동합니다...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            {/* 에러 메시지 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* 이메일 입력 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                이메일 *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                autoFocus={!emailParam}
                disabled={!!emailParam}
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-neutral-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* 이름 입력 (선택) */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                이름 (선택)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>

            {/* 전화번호 입력 */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                전화번호 *
              </label>
              <div className="flex gap-2">
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  disabled={isPhoneVerified}
                  className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all disabled:bg-green-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={handleSendSMS}
                  disabled={isSendingSMS || isPhoneVerified || !!smsSentAt}
                  className="px-4 py-2.5 bg-neutral-800 text-white rounded-md text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isPhoneVerified ? "✓ 인증완료" : isSendingSMS ? "발송중..." : smsSentAt ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : "인증번호"}
                </button>
              </div>
            </div>

            {/* 인증번호 입력 (SMS 발송 후 표시) */}
            {smsSentAt && !isPhoneVerified && (
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-1.5">
                  인증번호 입력
                </label>
                <div className="flex gap-2">
                  <input
                    id="verificationCode"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="6자리 숫자"
                    maxLength={6}
                    className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleVerifySMS}
                    disabled={isVerifyingSMS}
                    className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-md text-sm font-medium hover:from-red-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isVerifyingSMS ? "확인중..." : "확인"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {Math.floor(timeLeft / 60)}분 {timeLeft % 60}초 내에 입력해주세요
                </p>
              </div>
            )}

            {/* 비밀번호 입력 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호 *
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="영문+숫자 조합, 최소 8자"
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호 확인 *
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                className="w-full px-4 py-2.5 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>

            {/* 회원가입 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-md text-sm font-medium hover:from-red-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "회원가입 중..." : "회원가입"}
            </button>

            {/* 로그인 페이지로 이동 */}
            <button
              type="button"
              onClick={() => router.push("/?login=true")}
              className="w-full px-4 py-2.5 border border-neutral-300 text-neutral-700 rounded-md text-sm font-medium hover:bg-neutral-50 transition-colors"
            >
              이미 계정이 있으신가요? 로그인
            </button>
          </form>
        )}

        {/* 약관 안내 */}
        <div className="mt-6 pt-6 border-t border-neutral-100">
          <p className="text-xs text-neutral-500 text-center leading-relaxed">
            회원가입하면 집체크의{" "}
            <Link
              href="/terms?tab=terms"
              target="_blank"
              className="text-neutral-700 hover:text-neutral-900 underline underline-offset-2"
            >
              이용약관
            </Link>
            {" "}및{" "}
            <Link
              href="/terms?tab=privacy"
              target="_blank"
              className="text-neutral-700 hover:text-neutral-900 underline underline-offset-2"
            >
              개인정보 보호 정책
            </Link>
            에 동의하는 것으로 간주됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-neutral-600">로딩 중...</p>
        </div>
      </div>
    }>
      <SignupPageContent />
    </Suspense>
  );
}

// Auth Error Page

import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const code = params.code ?? "unknown_error";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            로그인 오류
          </h1>
          <p className="text-gray-600 mb-6">
            로그인 중 문제가 발생했습니다.
          </p>
          <div className="bg-gray-100 rounded p-4 mb-6">
            <p className="text-sm text-gray-700 font-mono">
              {decodeURIComponent(code)}
            </p>
          </div>
          <Link
            href="/"
            className="inline-block bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

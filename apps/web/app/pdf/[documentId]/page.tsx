/**
 * PDF 뷰어 전용 페이지
 *
 * 경로: /pdf/[documentId]
 * 예시: /pdf/doc_abc123def456
 *
 * 보안:
 * - Supabase Auth 인증 필요
 * - RLS로 사용자별 문서 접근 제어
 * - 암호화된 파일 URL 제공
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PDFViewer from '@/components/pdf/PDFViewer';
import { decrypt } from '@/lib/encryption';

export default function PDFViewerPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params?.documentId as string;

  const [fileUrl, setFileUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  async function loadDocument() {
    try {
      // 1. 인증 확인
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/');
        return;
      }

      // 2. 문서 메타데이터 조회
      const { data: document, error: docError } = await supabase
        .from('v2_documents')
        .select('id, user_id, file_name, file_path, property_address')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        setError('문서를 찾을 수 없습니다.');
        setIsLoading(false);
        return;
      }

      // 3. 권한 확인 (본인 문서만 열람 가능, RLS가 자동으로 처리)
      if (document.user_id !== session.user.id) {
        setError('접근 권한이 없습니다.');
        setIsLoading(false);
        return;
      }

      // 4. 파일명 복호화 (암호화된 경우)
      let displayName = document.file_name || '문서.pdf';
      const propertyAddress = document.property_address;

      if (propertyAddress) {
        try {
          const decryptedAddress = decrypt(propertyAddress);
          displayName = `${decryptedAddress}_등기부등본.pdf`;
        } catch (err) {
          // 복호화 실패 시 원본 사용
          console.warn('Failed to decrypt property address:', err);
        }
      }

      setFileName(displayName);

      // 5. Supabase Storage에서 서명된 URL 가져오기
      if (document.file_path) {
        // Supabase Storage 경로인 경우
        if (document.file_path.startsWith('documents/')) {
          const { data: urlData, error: urlError } = await supabase.storage
            .from('zipcheck-documents')
            .createSignedUrl(document.file_path, 3600); // 1시간 유효

          if (urlError || !urlData) {
            setError('파일 URL을 생성할 수 없습니다.');
            setIsLoading(false);
            return;
          }

          setFileUrl(urlData.signedUrl);
        } else {
          // 로컬 파일 경로인 경우 (API 프록시 사용)
          setFileUrl(`/api/pdf/proxy?path=${encodeURIComponent(document.file_path)}`);
        }
      } else {
        setError('파일 경로가 없습니다.');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    } catch (err) {
      console.error('문서 로드 실패:', err);
      setError('문서를 불러오는 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  }

  function handleClose() {
    router.back();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4" />
          <p className="text-neutral-600">문서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="text-center max-w-md">
          <div className="bg-white p-8 rounded-xl shadow-lg">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              오류 발생
            </h2>
            <p className="text-neutral-600 mb-6">{error}</p>
            <button
              onClick={() => router.back()}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <PDFViewer
        fileUrl={fileUrl}
        fileName={fileName}
        allowDownload={true}
        onClose={handleClose}
      />
    </div>
  );
}

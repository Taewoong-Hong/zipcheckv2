'use client';

import { useModalStore } from '@/lib/stores/modalStore';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// 모달 컴포넌트 동적 임포트 (코드 스플리팅)
const AddressSearchModal = dynamic(
  () => import('@/components/analysis/AddressSearchModal'),
  { ssr: false }
);

const ContractTypeSelector = dynamic(
  () => import('@/components/analysis/ContractTypeSelector'),
  { ssr: false }
);

const RegistryChoiceSelector = dynamic(
  () => import('@/components/analysis/RegistryChoiceSelector'),
  { ssr: false }
);

/**
 * 전역 모달 관리 컴포넌트
 *
 * - 앱 최상위 레벨에서 한 번만 렌더링
 * - modalStore의 상태에 따라 적절한 모달 표시
 * - 메시지 히스토리와 독립적으로 동작
 */
export default function GlobalModalManager() {
  const { type, props, isOpen, close } = useModalStore();

  // 모달이 열려있지 않으면 null 반환
  if (!isOpen || !type) {
    return null;
  }

  // 타입별 모달 렌더링
  const renderModal = () => {
    switch (type) {
      case 'address_search':
        return (
          <AddressSearchModal
            {...(props as any)}
            onClose={() => {
              // props에 onClose가 있으면 먼저 실행
              if ((props as any)?.onClose) {
                (props as any).onClose();
              }
              close();
            }}
          />
        );

      case 'contract_type':
        return (
          <ContractTypeSelector
            {...(props as any)}
            onClose={() => {
              if ((props as any)?.onClose) {
                (props as any).onClose();
              }
              close();
            }}
          />
        );

      case 'registry_choice':
        return (
          <RegistryChoiceSelector
            {...(props as any)}
            onClose={() => {
              if ((props as any)?.onClose) {
                (props as any).onClose();
              }
              close();
            }}
          />
        );

      default:
        console.warn('[GlobalModalManager] Unknown modal type:', type);
        return null;
    }
  };

  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </div>
    }>
      {/* 모달 포털 영역 */}
      <div
        className="modal-portal"
        role="dialog"
        aria-modal="true"
      >
        {renderModal()}
      </div>
    </Suspense>
  );
}
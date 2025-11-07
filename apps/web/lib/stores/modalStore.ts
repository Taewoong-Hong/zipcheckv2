/**
 * 중앙 모달 상태 관리 스토어
 *
 * UI 컴포넌트와 메시지 로그를 분리하여 관리
 * - 모달 상태는 이 스토어에서 중앙 관리
 * - 메시지 배열에는 컨텐츠만 저장
 */
import { create } from 'zustand';

// 지원하는 모달 타입
export type ModalType =
  | 'address_search'
  | 'contract_type'
  | 'price_input'
  | 'registry_choice';

// 모달별 props 타입 정의
export interface ModalProps {
  address_search?: {
    initialAddress?: string;
    onSelect?: (address: string, addressData: any) => void;
    onClose?: () => void;
  };
  contract_type?: {
    onSelect?: (type: string) => void;
    onClose?: () => void;
  };
  price_input?: {
    contractType?: string;
    onSubmit?: (price: number, deposit?: number) => void;
    onClose?: () => void;
  };
  registry_choice?: {
    userCredits?: number;
    registryCost?: number;
    onChoice?: (choice: 'upload' | 'issue') => void;
    onClose?: () => void;
  };
}

// 스토어 상태 인터페이스
interface ModalState {
  type: ModalType | null;
  props: ModalProps[ModalType] | null;
  isOpen: boolean;

  // 액션
  open: <T extends ModalType>(type: T, props?: ModalProps[T]) => void;
  close: () => void;
  updateProps: <T extends ModalType>(props: Partial<ModalProps[T]>) => void;
}

// Zustand 스토어 생성
export const useModalStore = create<ModalState>((set, get) => ({
  type: null,
  props: null,
  isOpen: false,

  open: (type, props) => {
    console.log('[ModalStore] Opening modal:', type, props);
    set({
      type,
      props: props || null,
      isOpen: true
    });
  },

  close: () => {
    const currentType = get().type;
    console.log('[ModalStore] Closing modal:', currentType);

    // onClose 콜백 실행 (있으면)
    const props = get().props as any;
    if (props?.onClose) {
      props.onClose();
    }

    set({
      type: null,
      props: null,
      isOpen: false
    });
  },

  updateProps: (newProps) => {
    const currentProps = get().props;
    set({
      props: { ...currentProps, ...newProps } as any
    });
  }
}));

// 헬퍼 함수: 특정 모달 열기
export const openAddressSearchModal = (
  initialAddress?: string,
  onSelect?: (address: string, addressData: any) => void
) => {
  useModalStore.getState().open('address_search', {
    initialAddress,
    onSelect
  });
};

export const openContractTypeModal = (
  onSelect?: (type: string) => void
) => {
  useModalStore.getState().open('contract_type', {
    onSelect
  });
};

export const openPriceInputModal = (
  contractType?: string,
  onSubmit?: (price: number, deposit?: number) => void
) => {
  useModalStore.getState().open('price_input', {
    contractType,
    onSubmit
  });
};

export const openRegistryChoiceModal = (
  userCredits?: number,
  registryCost?: number,
  onChoice?: (choice: 'upload' | 'issue') => void
) => {
  useModalStore.getState().open('registry_choice', {
    userCredits,
    registryCost,
    onChoice
  });
};
/**
 * 계약 유형 선택 컴포넌트
 *
 * @description
 * 전세, 전월세, 월세, 매매 4가지 계약 유형 선택 UI
 *
 * @author 집체크 개발팀
 * @version 1.0.0
 * @date 2025-01-27
 */

'use client';

import { useState } from 'react';
import { Home, Key, DollarSign, Briefcase } from 'lucide-react';
import type { ContractType } from '@/types/analysis';

export interface ContractTypeSelectorProps {
  onSelect: (type: ContractType) => void;
  disabled?: boolean;
}

interface ContractOption {
  type: ContractType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  hoverBgColor: string;
  selectedBgColor: string;
}

const CONTRACT_OPTIONS: ContractOption[] = [
  {
    type: '전세',
    label: '전세',
    description: '보증금만 있는 임대차 계약',
    icon: Home,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    hoverBgColor: 'hover:bg-blue-100',
    selectedBgColor: 'bg-blue-500',
  },
  {
    type: '전월세',
    label: '전월세 (반전세)',
    description: '보증금 + 월세',
    icon: Key,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    hoverBgColor: 'hover:bg-green-100',
    selectedBgColor: 'bg-green-500',
  },
  {
    type: '월세',
    label: '월세',
    description: '보증금(소액) + 월세',
    icon: DollarSign,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    hoverBgColor: 'hover:bg-purple-100',
    selectedBgColor: 'bg-purple-500',
  },
  {
    type: '매매',
    label: '매매',
    description: '부동산 소유권 매매 계약',
    icon: Briefcase,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    hoverBgColor: 'hover:bg-red-100',
    selectedBgColor: 'bg-red-500',
  },
];

export default function ContractTypeSelector({
  onSelect,
  disabled = false,
}: ContractTypeSelectorProps) {
  const [selectedType, setSelectedType] = useState<ContractType | null>(null);
  const [hoveredType, setHoveredType] = useState<ContractType | null>(null);

  const handleSelect = (type: ContractType) => {
    setSelectedType(type);
    onSelect(type);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* 타이틀 */}
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold text-neutral-900 mb-2">
          계약 유형을 선택해주세요
        </h3>
        <p className="text-neutral-600">
          분석하실 부동산 계약의 종류를 선택하시면, 맞춤형 리스크 분석을 제공합니다.
        </p>
      </div>

      {/* 옵션 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CONTRACT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;
          const isHovered = hoveredType === option.type;

          return (
            <button
              key={option.type}
              onClick={() => !disabled && handleSelect(option.type)}
              onMouseEnter={() => setHoveredType(option.type)}
              onMouseLeave={() => setHoveredType(null)}
              disabled={disabled}
              className={`
                relative p-6 rounded-2xl border-2 transition-all duration-200
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${
                  isSelected
                    ? `${option.selectedBgColor} border-transparent text-white shadow-lg scale-[1.02]`
                    : `${option.bgColor} border-neutral-200 ${option.hoverBgColor}`
                }
              `}
            >
              {/* 체크마크 (선택 시) */}
              {isSelected && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                    <svg
                      className={option.color}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M13.3332 4L5.99984 11.3333L2.6665 8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* 아이콘 */}
              <div className="mb-4">
                <div
                  className={`
                    inline-flex p-3 rounded-xl
                    ${
                      isSelected
                        ? 'bg-white/20'
                        : isHovered
                        ? 'bg-white/50'
                        : 'bg-white'
                    }
                  `}
                >
                  <Icon
                    className={`w-8 h-8 ${
                      isSelected ? 'text-white' : option.color
                    }`}
                  />
                </div>
              </div>

              {/* 라벨 */}
              <h4
                className={`text-xl font-bold mb-2 ${
                  isSelected ? 'text-white' : 'text-neutral-900'
                }`}
              >
                {option.label}
              </h4>

              {/* 설명 */}
              <p
                className={`text-sm ${
                  isSelected ? 'text-white/90' : 'text-neutral-600'
                }`}
              >
                {option.description}
              </p>

              {/* 호버 효과 인디케이터 */}
              {!isSelected && isHovered && (
                <div
                  className={`absolute bottom-0 left-0 right-0 h-1 ${option.selectedBgColor} rounded-b-2xl`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 선택 안내 */}
      {!selectedType && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800 text-center">
            💡 <strong>도움말</strong>: 계약 유형에 따라 분석되는 리스크 항목이 달라집니다.
            <br />
            전세/전월세는 전세가율과 선순위 채권을, 매매는 권리관계와 협상 포인트를 중점 분석합니다.
          </p>
        </div>
      )}

      {/* 선택 확인 */}
      {selectedType && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 text-center">
            ✅ <strong>{selectedType}</strong> 계약이 선택되었습니다.
            <br />
            다음 단계로 진행합니다...
          </p>
        </div>
      )}
    </div>
  );
}

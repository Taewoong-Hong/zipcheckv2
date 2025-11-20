'use client';

import { useState } from 'react';
import { ContractType } from '@/types/analysis';

interface PriceInputProps {
  contractType: ContractType;
  onPriceSubmit: (data: PriceData) => void;
}

export interface PriceData {
  deposit?: number;      // 보증금 (전세/월세/전월세) 또는 매매가 (매매)
  monthlyRent?: number;  // 월세 (월세/전월세만)
}

export default function PriceInput({ contractType, onPriceSubmit }: PriceInputProps) {
  const [deposit, setDeposit] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [error, setError] = useState('');

  const getDepositLabel = () => {
    if (contractType === '매매') return '매매가';
    return '보증금';
  };

  const needsMonthlyRent = contractType === '월세' || contractType === '전월세';

  const formatNumber = (value: string): string => {
    const number = value.replace(/[^0-9]/g, '');
    if (!number) return '';
    return Number(number).toLocaleString('ko-KR');
  };

  const parseNumber = (value: string): number => {
    return Number(value.replace(/[^0-9]/g, ''));
  };

  const handleDepositChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNumber(e.target.value);
    setDeposit(formatted);
    setError('');
  };

  // 보증금을 억원 단위로 환산
  const getDepositInEok = (): string => {
    const depositValue = parseNumber(deposit);
    if (!depositValue || depositValue === 0) return '';

    const eok = depositValue / 10000;
    if (eok >= 1) {
      return `≈ ${eok.toFixed(2)}억원`;
    } else {
      const cheon = depositValue / 1000;
      return `≈ ${cheon.toFixed(1)}천만원`;
    }
  };

  const handleMonthlyRentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNumber(e.target.value);
    setMonthlyRent(formatted);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const depositValue = parseNumber(deposit);

    if (!depositValue || depositValue <= 0) {
      setError(`${getDepositLabel()}을(를) 입력해주세요.`);
      return;
    }

    if (needsMonthlyRent) {
      const monthlyRentValue = parseNumber(monthlyRent);
      if (!monthlyRentValue || monthlyRentValue <= 0) {
        setError('월세를 입력해주세요.');
        return;
      }
      onPriceSubmit({ deposit: depositValue, monthlyRent: monthlyRentValue });
    } else {
      onPriceSubmit({ deposit: depositValue });
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        💰 가격 정보 입력
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 보증금/매매가 입력 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getDepositLabel()}
          </label>
          <div className="relative">
            <input
              type="text"
              value={deposit}
              onChange={handleDepositChange}
              placeholder="예: 50,000"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <span className="absolute right-4 top-3 text-gray-500">만원</span>
          </div>
          {/* 억원 환산 표시 (보증금만) */}
          {contractType !== '매매' && getDepositInEok() && (
            <p className="mt-2 text-sm font-semibold text-blue-600">
              {getDepositInEok()}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {contractType === '매매' ? '매매 계약 금액을 입력해주세요.' : '보증금 금액을 입력해주세요.'}
          </p>
        </div>

        {/* 월세 입력 (월세/전월세만) */}
        {needsMonthlyRent && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              월세
            </label>
            <div className="relative">
              <input
                type="text"
                value={monthlyRent}
                onChange={handleMonthlyRentChange}
                placeholder="예: 50"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <span className="absolute right-4 top-3 text-gray-500">만원</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              매월 납부할 월세 금액을 입력해주세요.
            </p>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
        >
          다음 단계로
        </button>

        {/* 입력 예시 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">💡 입력 예시</p>
          <div className="text-sm text-gray-600 space-y-1">
            {contractType === '매매' && (
              <p>• 매매가 5억원 → <span className="font-semibold">50,000</span> 만원</p>
            )}
            {contractType === '전세' && (
              <p>• 전세 보증금 3억원 → <span className="font-semibold">30,000</span> 만원</p>
            )}
            {(contractType === '월세' || contractType === '전월세') && (
              <>
                <p>• 보증금 1억원 → <span className="font-semibold">10,000</span> 만원</p>
                <p>• 월세 50만원 → <span className="font-semibold">50</span> 만원</p>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

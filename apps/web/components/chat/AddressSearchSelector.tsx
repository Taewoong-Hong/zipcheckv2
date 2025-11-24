"use client";

import React, { useState, useEffect } from "react";
import { Search, MapPin, Check } from "lucide-react";

interface AddressResult {
  roadAddr: string;        // 도로명주소
  jibunAddr: string;       // 지번주소
  zipNo: string;           // 우편번호
  bdNm: string;            // 건물명
  admCd: string;           // 행정구역코드
  rnMgtSn: string;         // 도로명코드
  udrtYn: string;          // 지하여부
  buldMnnm: string;        // 건물본번
  buldSlno: string;        // 건물부번
  detBdNmList: string;     // 상세건물명
}

interface AddressSearchSelectorProps {
  initialAddress?: string;
  onAddressSelect: (address: AddressResult, detailAddress: string) => void;
  onCancel?: () => void;
}

export default function AddressSearchSelector({
  initialAddress,
  onAddressSelect,
  onCancel,
}: AddressSearchSelectorProps) {
  const [searchQuery, setSearchQuery] = useState(initialAddress || "");
  const [searchResults, setSearchResults] = useState<AddressResult[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 상세주소 선택 상태
  const [selectedDong, setSelectedDong] = useState("");
  const [selectedHo, setSelectedHo] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");

  // 동/층/호수 선택지 (JUSO API 또는 fallback에서 추출)
  const [dongOptions, setDongOptions] = useState<string[]>([]);
  const [floorOptions, setFloorOptions] = useState<string[]>([]);
  const [hoOptions, setHoOptions] = useState<string[]>([]);

  // 층별 호수 매핑 (floorho API 응답용)
  const [floorHoMapping, setFloorHoMapping] = useState<Record<string, string[]>>({});

  // API 사용 가능 여부 (fallback 판단용)
  const [useJusoAPI, setUseJusoAPI] = useState(true);

  // 환경 감지: 프로덕션(Vercel)에서는 JUSO API 시도, 로컬에서는 Fallback 우선
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';

  // 주소 검색 API 호출
  const searchAddress = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setErrorMessage("검색어는 최소 2자 이상이어야 합니다.");
      return;
    }

    setIsSearching(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/address/search?q=${encodeURIComponent(searchQuery.trim())}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('주소 검색에 실패했습니다.');
      }

      const data = await response.json();

      if (data.error) {
        setSearchResults([]);
        setErrorMessage(data.error);
        return;
      }

      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
        setErrorMessage("");
      } else {
        setSearchResults([]);
        setErrorMessage("검색 결과가 없습니다. 다른 주소로 다시 시도해주세요.");
      }
    } catch (error) {
      console.error('Address search error:', error);
      setErrorMessage("주소 검색 중 오류가 발생했습니다.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Enter 키로 검색
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchAddress();
    }
  };

  // 주소 선택 핸들러 - 환경별 동작 분기
  const handleSelectAddress = async (address: AddressResult) => {
    setSelectedAddress(address);
    setSelectedDong("");
    setSelectedHo("");
    setSelectedFloor("");
    setDongOptions([]);
    setFloorOptions([]);
    setHoOptions([]);
    setFloorHoMapping({});

    // 로컬 환경: Fallback 모드 우선 사용
    if (!isProduction) {
      console.log('🔧 로컬 환경 감지 - Fallback 모드 사용');
      setUseJusoAPI(false);

      if (address.detBdNmList) {
        const details = address.detBdNmList.split(',').map(d => d.trim());

        // 동 추출
        const dongs = details
          .filter(d => d.includes('동'))
          .map(d => d.match(/\d+동/)?.[0])
          .filter((d): d is string => !!d);

        // 호 추출
        const hos = details
          .filter(d => d.includes('호'))
          .map(d => d.match(/\d+호/)?.[0])
          .filter((d): d is string => !!d);

        setDongOptions([...new Set(dongs)]);
        setHoOptions([...new Set(hos)]);

        // 하드코딩 층 옵션 (1~50층)
        const floors = Array.from({ length: 50 }, (_, i) => `${i + 1}층`);
        setFloorOptions(floors);

        console.log('✅ Fallback 파싱 완료 (로컬):', { dongs: dongs.length, hos: hos.length });
      }
      return;
    }

    // 프로덕션 환경: JUSO API 시도 + Fallback
    console.log('🚀 프로덕션 환경 감지 - JUSO API 시도');

    try {
      const params = new URLSearchParams({
        admCd: address.admCd,
        rnMgtSn: address.rnMgtSn,
        udrtYn: address.udrtYn || '0',
        buldMnnm: address.buldMnnm,
        buldSlno: address.buldSlno || '0',
        searchType: 'dong',
      });

      const response = await fetch(`/api/address/detail?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();

        if (data.dongList && data.dongList.length > 0) {
          // JUSO API 성공
          const dongs = data.dongList.map((item: any) => item.dongNm);
          setDongOptions(dongs);
          setUseJusoAPI(true);
          console.log('✅ JUSO API 동 목록 조회 성공:', dongs.length);
          return;
        }
      }
    } catch (error) {
      console.warn('⚠️ JUSO API 실패, fallback 사용:', error);
    }

    // Fallback: detBdNmList 파싱
    setUseJusoAPI(false);
    if (address.detBdNmList) {
      const details = address.detBdNmList.split(',').map(d => d.trim());

      // 동 추출
      const dongs = details
        .filter(d => d.includes('동'))
        .map(d => d.match(/\d+동/)?.[0])
        .filter((d): d is string => !!d);

      // 호 추출
      const hos = details
        .filter(d => d.includes('호'))
        .map(d => d.match(/\d+호/)?.[0])
        .filter((d): d is string => !!d);

      setDongOptions([...new Set(dongs)]);
      setHoOptions([...new Set(hos)]);

      // 하드코딩 층 옵션 (1~50층)
      const floors = Array.from({ length: 50 }, (_, i) => `${i + 1}층`);
      setFloorOptions(floors);

      console.log('✅ Fallback 파싱 완료 (프로덕션):', { dongs: dongs.length, hos: hos.length });
    }
  };

  // 동 선택 핸들러 - JUSO API로 층/호 조회
  const handleDongSelect = async (dongNm: string) => {
    setSelectedDong(dongNm);
    setSelectedFloor("");
    setSelectedHo("");
    setFloorOptions([]);
    setHoOptions([]);

    if (!useJusoAPI || !selectedAddress) {
      return; // Fallback 모드면 조회 안 함
    }

    // "'동'없음" 선택 시: 하드코딩 층 목록 제공
    if (dongNm === "'동'없음") {
      const floors = Array.from({ length: 50 }, (_, i) => `${i + 1}층`);
      setFloorOptions(floors);
      console.log('✅ "동 없음" 선택 - 기본 층 목록 제공 (1~50층)');
      return;
    }

    // JUSO API: 층/호 목록 조회
    try {
      const params = new URLSearchParams({
        admCd: selectedAddress.admCd,
        rnMgtSn: selectedAddress.rnMgtSn,
        udrtYn: selectedAddress.udrtYn || '0',
        buldMnnm: selectedAddress.buldMnnm,
        buldSlno: selectedAddress.buldSlno || '0',
        searchType: 'floorho',
        dongNm: dongNm,
      });

      const response = await fetch(`/api/address/detail?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();

        if (data.floorList && data.floorHoMapping) {
          setFloorOptions(data.floorList);
          setFloorHoMapping(data.floorHoMapping);
          console.log('✅ JUSO API 층/호 조회 성공:', data.floorList.length);
          return;
        }
      }
    } catch (error) {
      console.error('❌ JUSO API floorho 조회 실패:', error);
    }
  };

  // 층 선택 핸들러 - 해당 층의 호수 목록 표시
  const handleFloorSelect = (floor: string) => {
    setSelectedFloor(floor);

    if (useJusoAPI && floorHoMapping[floor]) {
      // JUSO API 모드: 층에 해당하는 호수 목록
      setHoOptions(floorHoMapping[floor]);
    }
    // Fallback 모드: hoOptions는 이미 설정되어 있음
  };

  // 확인 버튼 핸들러
  const handleConfirm = () => {
    if (selectedAddress) {
      // 층 필수 검증 (단, 층 옵션이 있는 경우에만)
      if (isProduction && floorOptions.length > 0 && !selectedFloor) {
        setErrorMessage("층을 선택해주세요.");
        return;
      }

      setErrorMessage("");

      // 선택한 동/층/호를 조합하여 상세주소 생성
      const details = [selectedDong, selectedFloor, selectedHo].filter(Boolean).join(' ');
      onAddressSelect(selectedAddress, details);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 bg-white rounded-xl border border-neutral-200 shadow-sm">
      {/* 검색 입력 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          주소 검색
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="예: 서울특별시 강남구 테헤란로 123"
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          </div>
          <button
            onClick={searchAddress}
            disabled={isSearching}
            className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? "검색 중..." : "검색"}
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* 검색 결과 */}
      {searchResults.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            검색 결과 ({searchResults.length}개)
          </label>
          <div className="max-h-64 overflow-y-auto border border-neutral-200 rounded-lg divide-y divide-neutral-200">
            {searchResults.map((address, index) => (
              <button
                key={index}
                onClick={() => handleSelectAddress(address)}
                className={`w-full text-left p-3 hover:bg-neutral-50 transition-colors ${
                  selectedAddress === address ? "bg-brand-50 border-l-4 border-brand-primary" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-brand-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-neutral-800 text-sm truncate">
                        {address.roadAddr}
                      </p>
                      {selectedAddress === address && (
                        <Check className="w-4 h-4 text-brand-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-neutral-600 mt-1">
                      지번: {address.jibunAddr}
                    </p>
                    {address.bdNm && (
                      <p className="text-xs text-neutral-500 mt-0.5">
                        건물명: {address.bdNm}
                      </p>
                    )}
                    <p className="text-xs text-neutral-400 mt-0.5">
                      우편번호: {address.zipNo}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 선택된 주소 - 상세주소 입력 */}
      {selectedAddress && (
        <div className="mb-4 p-4 bg-brand-50 border border-brand-200 rounded-lg">
          <p className="text-sm font-medium text-neutral-700 mb-3">선택된 주소</p>
          <div className="space-y-1 mb-4">
            <p className="text-sm text-neutral-800">
              <span className="font-medium">도로명:</span> {selectedAddress.roadAddr}
            </p>
            <p className="text-sm text-neutral-800">
              <span className="font-medium">지번:</span> {selectedAddress.jibunAddr}
            </p>
            {selectedAddress.bdNm && (
              <p className="text-sm text-neutral-800">
                <span className="font-medium">건물명:</span> {selectedAddress.bdNm}
              </p>
            )}
          </div>

          {/* 상세주소 입력 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-neutral-700">
              상세주소
            </label>

            {/* 동 선택 (선택사항) */}
            {dongOptions.length > 0 ? (
              <select
                value={selectedDong}
                onChange={(e) => {
                  const value = e.target.value;
                  handleDongSelect(value);
                }}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option value="">동을 선택해주세요. (선택)</option>
                {dongOptions.map((dong) => (
                  <option key={dong} value={dong}>{dong}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="동을 입력해주세요. (선택)"
                value={selectedDong}
                onChange={(e) => setSelectedDong(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            )}

            {/* 층 선택 (필수) */}
            {floorOptions.length > 0 ? (
              <div>
                <select
                  value={selectedFloor}
                  onChange={(e) => handleFloorSelect(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                >
                  <option value="">층을 선택해주세요. (필수)</option>
                  {!useJusoAPI && <option value="0층">지하(0층)</option>}
                  {floorOptions.map((floor) => (
                    <option key={floor} value={floor}>{floor}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-neutral-500">
                  *층은 필수 선택 사항입니다.{!useJusoAPI && ' 지하의 경우 \'지하(0층)\'을 선택해주세요.'}
                </p>
              </div>
            ) : null}

            {/* 호 선택 (선택사항) */}
            {hoOptions.length > 0 ? (
              <select
                value={selectedHo}
                onChange={(e) => setSelectedHo(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option value="">호를 선택해주세요. (선택)</option>
                {hoOptions.map((ho) => (
                  <option key={ho} value={ho}>{ho}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="호를 입력해주세요. (선택)"
                value={selectedHo}
                onChange={(e) => setSelectedHo(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            )}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            취소
          </button>
        )}
        <button
          onClick={handleConfirm}
          disabled={!selectedAddress || (isProduction && floorOptions.length > 0 && !selectedFloor)}
          className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          이 주소로 계속하기
        </button>
      </div>
    </div>
  );
}

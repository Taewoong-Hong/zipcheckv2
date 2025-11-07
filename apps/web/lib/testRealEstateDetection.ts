/**
 * 부동산 분석 요청 감지 테스트 케이스
 *
 * 이 파일은 route.ts의 isRealEstateAnalysisRequest 함수를 테스트하기 위한
 * 다양한 입력 패턴과 예상 결과를 정의합니다.
 */

export interface TestCase {
  input: string;
  expectedResult: boolean;
  category: string;
  description: string;
}

export const testCases: TestCase[] = [
  // ===== 분석 요청 패턴 (true) =====

  // 1. 명시적 분석 요청
  {
    input: "이 아파트 분석해줘",
    expectedResult: true,
    category: "explicit_analysis",
    description: "직접적인 분석 요청"
  },
  {
    input: "강남구 대치동 아파트 검토 부탁해",
    expectedResult: true,
    category: "explicit_analysis",
    description: "지역명 + 검토 요청"
  },
  {
    input: "전세 계약 리스크 체크해줘",
    expectedResult: true,
    category: "explicit_analysis",
    description: "계약 타입 + 리스크 체크"
  },
  {
    input: "이 집 위험한지 확인해줘",
    expectedResult: true,
    category: "explicit_analysis",
    description: "위험 확인 요청"
  },

  // 2. 계약 의도 표현
  {
    input: "전세 계약하려고 하는데",
    expectedResult: true,
    category: "contract_intent",
    description: "전세 계약 의도"
  },
  {
    input: "이 아파트 매매하고 싶어",
    expectedResult: true,
    category: "contract_intent",
    description: "매매 의도 표현"
  },
  {
    input: "월세 계약할 예정이야",
    expectedResult: true,
    category: "contract_intent",
    description: "월세 계약 예정"
  },
  {
    input: "부동산 계약할건데 괜찮을까",
    expectedResult: true,
    category: "contract_intent",
    description: "계약 의사 + 확인"
  },

  // 3. 등기부 관련 요청
  {
    input: "등기부 확인하고 싶어",
    expectedResult: true,
    category: "registry_request",
    description: "등기부 확인 요청"
  },
  {
    input: "등기부등본 봐줘",
    expectedResult: true,
    category: "registry_request",
    description: "등기부등본 검토 요청"
  },
  {
    input: "등기 내용 분석해줘",
    expectedResult: true,
    category: "registry_request",
    description: "등기 분석 요청"
  },

  // 4. 복합 패턴
  {
    input: "서울시 강남구 역삼동 123번지 아파트 전세 계약하려는데 분석해줘",
    expectedResult: true,
    category: "complex",
    description: "주소 + 계약타입 + 분석 요청"
  },
  {
    input: "이 오피스텔 월세로 들어가려는데 위험요소 체크 부탁해",
    expectedResult: true,
    category: "complex",
    description: "부동산 타입 + 계약 의도 + 체크 요청"
  },

  // ===== 일반 대화 패턴 (false) =====

  // 1. 인사말
  {
    input: "안녕하세요",
    expectedResult: false,
    category: "greeting",
    description: "일반 인사"
  },
  {
    input: "반갑습니다",
    expectedResult: false,
    category: "greeting",
    description: "일반 인사"
  },

  // 2. 정보 요청 (분석 아님)
  {
    input: "전세가율이 뭐야?",
    expectedResult: false,
    category: "info_request",
    description: "용어 설명 요청"
  },
  {
    input: "등기부는 어떻게 떼?",
    expectedResult: false,
    category: "info_request",
    description: "방법 문의"
  },
  {
    input: "부동산 시세가 어떻게 돼?",
    expectedResult: false,
    category: "info_request",
    description: "시세 문의 (특정 물건 아님)"
  },

  // 3. 애매한 경우
  {
    input: "아파트 어때?",
    expectedResult: false,
    category: "ambiguous",
    description: "구체적이지 않은 질문"
  },
  {
    input: "집 보러 갔어",
    expectedResult: false,
    category: "ambiguous",
    description: "단순 정보 공유"
  },
  {
    input: "부동산 시장이 요즘 어려워",
    expectedResult: false,
    category: "ambiguous",
    description: "일반적인 시장 언급"
  },

  // ===== 경계선 케이스 =====

  {
    input: "이 집 살만해?",
    expectedResult: true,
    category: "boundary",
    description: "평가 요청 (분석 의도 있음)"
  },
  {
    input: "여기 전세 들어가도 될까?",
    expectedResult: true,
    category: "boundary",
    description: "의사결정 도움 요청"
  },
  {
    input: "매매가가 적당한지 봐줘",
    expectedResult: true,
    category: "boundary",
    description: "가격 적정성 평가"
  }
];

/**
 * isRealEstateAnalysisRequest 함수의 간소화된 버전 (테스트용)
 * route.ts의 실제 함수를 복사해서 사용
 */
export function isRealEstateAnalysisRequest(t: string): boolean {
  const s = t.toLowerCase();

  // 분석 요청 키워드 (핵심)
  const analysisKeywords = [
    '분석', '검토', '체크', '확인', '점검', '리스크', '위험',
    '살펴', '알아', '조사', '평가', '검사', '진단', '감정'
  ];

  // 부동산 관련 키워드
  const realEstateKeywords = [
    '아파트', '빌라', '오피스텔', '주택', '부동산', '집',
    '전세', '월세', '매매', '계약', '등기', '등기부'
  ];

  // 의도 표현 키워드
  const intentKeywords = [
    '하려고', '할려고', '하고싶', '하고 싶', '예정', '계획',
    '할건데', '할 건데', '하는데', '할까', '해줘', '해주',
    '보고싶', '보고 싶', '봐줘', '봐주'
  ];

  // 1. 명시적 분석 요청 (분석 키워드 + 부동산 키워드)
  const hasAnalysisKeyword = analysisKeywords.some(keyword => s.includes(keyword));
  const hasRealEstateKeyword = realEstateKeywords.some(keyword => s.includes(keyword));

  if (hasAnalysisKeyword && hasRealEstateKeyword) {
    return true;
  }

  // 2. 계약 의도 표현 (계약 관련 + 의도 키워드)
  const contractKeywords = ['전세', '월세', '매매', '계약'];
  const hasContractKeyword = contractKeywords.some(keyword => s.includes(keyword));
  const hasIntentKeyword = intentKeywords.some(keyword => s.includes(keyword));

  if (hasContractKeyword && hasIntentKeyword) {
    return true;
  }

  // 3. 등기부 관련 요청
  const registryKeywords = ['등기', '등기부', '등본'];
  const registryActionKeywords = ['확인', '봐', '보고', '분석', '체크', '검토'];

  const hasRegistryKeyword = registryKeywords.some(keyword => s.includes(keyword));
  const hasRegistryAction = registryActionKeywords.some(keyword => s.includes(keyword));

  if (hasRegistryKeyword && hasRegistryAction) {
    return true;
  }

  // 4. 평가/의사결정 요청 패턴
  const evaluationPatterns = [
    /살만해/,
    /괜찮/,
    /어때/,
    /적당한지/,
    /들어가도 될까/,
    /계약해도 될까/
  ];

  // 부동산 컨텍스트와 함께 평가 요청이 있는 경우
  if (hasRealEstateKeyword && evaluationPatterns.some(pattern => pattern.test(s))) {
    return true;
  }

  return false;
}

/**
 * 테스트 실행 함수
 */
export function runTests(): { passed: number; failed: number; results: Array<{ test: TestCase; actual: boolean }> } {
  const results = testCases.map(test => ({
    test,
    actual: isRealEstateAnalysisRequest(test.input)
  }));

  const passed = results.filter(r => r.actual === r.test.expectedResult).length;
  const failed = results.filter(r => r.actual !== r.test.expectedResult).length;

  return { passed, failed, results };
}

/**
 * 테스트 결과를 콘솔에 출력
 */
export function printTestResults(): void {
  const { passed, failed, results } = runTests();

  console.log('='.repeat(80));
  console.log('부동산 분석 요청 감지 테스트 결과');
  console.log('='.repeat(80));
  console.log(`✅ 통과: ${passed}개`);
  console.log(`❌ 실패: ${failed}개`);
  console.log(`📊 정확도: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));

  // 카테고리별 결과
  const categories = [...new Set(testCases.map(t => t.category))];
  for (const category of categories) {
    const categoryTests = results.filter(r => r.test.category === category);
    const categoryPassed = categoryTests.filter(r => r.actual === r.test.expectedResult).length;
    const categoryTotal = categoryTests.length;

    console.log(`\n📁 ${category}: ${categoryPassed}/${categoryTotal} 통과`);

    // 실패한 케이스 표시
    const failures = categoryTests.filter(r => r.actual !== r.test.expectedResult);
    if (failures.length > 0) {
      failures.forEach(f => {
        console.log(`  ❌ "${f.test.input}"`);
        console.log(`     예상: ${f.test.expectedResult}, 실제: ${f.actual}`);
      });
    }
  }

  console.log('\n' + '='.repeat(80));
}

// 브라우저 환경에서 테스트 실행을 위한 전역 함수 등록
if (typeof window !== 'undefined') {
  (window as any).testRealEstateDetection = printTestResults;
}
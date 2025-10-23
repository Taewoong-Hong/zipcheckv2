// 이용약관 JSON 데이터 타입 정의
export interface TermsData {
  service: {
    name_ko: string;
    name_en: string;
    website: string;
  };
  versioning: {
    version: string;
    effective_date: string;
    last_updated: string;
    jurisdiction: string;
  };
  legal_basis_refs: string[];
  sections: TermsSection[];
  privacy_cross_reference: {
    policy_url: string;
    notes: string[];
  };
  service_specific_notices: string[];
}

export interface TermsSection {
  article: number;
  title: string;
  body?: string;
  definitions?: Record<string, string>;
  rules?: string[];
  prohibited?: string[];
  account_security?: string;
  may_defer?: string[];
  may_reject?: string[];
  cases?: string[];
  maintenance?: string;
  liability?: string;
  shutdown?: string;
}

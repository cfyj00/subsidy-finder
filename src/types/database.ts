// ─── Profile ────────────────────────────────────
export interface Profile {
  id: string;
  display_name: string | null;
  phone: string | null;
  is_premium: boolean;
  onboarding_done: boolean;
  active_business_profile_id: string | null; // 009_multi_profile
  created_at: string;
}

// ─── Business Profile ───────────────────────────
export interface BusinessProfile {
  id: string;
  user_id: string;
  profile_name: string | null;  // 009_multi_profile: 프로필 별칭 (예: "본사", "2공장")
  business_name: string;
  business_reg_number: string | null;
  representative_name: string | null;
  business_type: string;
  business_category: string | null;
  industry_code: string | null;
  region_sido: string;
  region_sigungu: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  establishment_date: string | null;
  company_age_years: number | null;
  is_venture: boolean;
  is_innobiz: boolean;
  is_mainbiz: boolean;
  has_smart_factory: boolean;
  smart_factory_level: string | null;
  current_challenges: string[];
  goals: string[];
  previous_subsidies: PreviousSubsidy[];
  notes: string | null;
  // ── 타겟팅 필드 (005 migration) ──────────────────
  business_entity_type: '개인사업자' | '법인' | '협동조합' | '사회적기업' | '기타' | null;
  has_export: boolean;
  annual_export_amount: number | null;
  main_products: string | null;
  updated_at: string;
  created_at: string;
}

export interface PreviousSubsidy {
  name: string;
  year: number;
  amount: number;
}

// ─── Program ────────────────────────────────────
export interface Program {
  id: string;
  external_id: string | null;
  source: string;
  title: string;
  managing_org: string | null;
  implementing_org: string | null;
  category: string;
  subcategory: string | null;
  support_type: string | null;
  target_industries: string[];
  target_regions: string[];
  target_company_size: string[];
  min_employee_count: number | null;
  max_employee_count: number | null;
  min_revenue: number | null;
  max_revenue: number | null;
  min_company_age: number | null;
  max_company_age: number | null;
  funding_amount_min: number | null;
  funding_amount_max: number | null;
  self_funding_ratio: number | null;
  application_start: string | null;
  application_end: string | null;
  status: string;
  description: string | null;
  eligibility_summary: string | null;
  required_documents: string[];
  detail_url: string | null;
  is_featured: boolean;
  is_recurring?: boolean;                  // 매년 반복 여부 (DB default: false)
  typical_open_month?: number | null;      // 보통 모집 시작 월 (1-12)
  typical_duration_weeks?: number | null;  // 보통 모집 기간 (주)
  last_active_year?: number | null;        // 마지막으로 운영된 연도
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Application ────────────────────────────────
export type ApplicationStatus =
  | 'preparing'
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'rejected';

export interface UserApplication {
  id: string;
  user_id: string;
  program_id: string | null;
  program_title: string;
  managing_org: string | null;
  application_deadline: string | null;  // DATE as string "YYYY-MM-DD"
  applied_amount: number | null;        // 만원 단위
  result_amount: number | null;         // 만원 단위
  status: ApplicationStatus;
  submitted_at: string | null;
  result_at: string | null;
  notes: string | null;
  program_url: string | null;           // 공식 사이트 URL
  created_at: string;
  updated_at: string;
}

// ─── Match ──────────────────────────────────────
export interface UserProgramMatch {
  id: string;
  user_id: string;
  program_id: string;
  match_score: number;
  match_reasons: string[];
  mismatch_reasons: string[];
  is_bookmarked: boolean;
  is_dismissed: boolean;
  calculated_at: string;
  program?: Program;
}

-- =====================================================
-- 005_business_profile_targeting.sql
-- 지원사업 타겟팅 정밀도 향상을 위한 프로필 필드 추가
-- =====================================================

ALTER TABLE business_profiles
  -- 기업 형태: 많은 사업이 법인/개인사업자만 대상으로 함
  ADD COLUMN IF NOT EXISTS business_entity_type TEXT
    CHECK (business_entity_type IN ('개인사업자', '법인', '협동조합', '사회적기업', '기타')),

  -- 수출 여부: 수출바우처·해외진출 사업 매칭에 필수
  ADD COLUMN IF NOT EXISTS has_export BOOLEAN NOT NULL DEFAULT false,

  -- 수출 실적 (백만원 단위): 수출 지원사업 규모 매칭
  ADD COLUMN IF NOT EXISTS annual_export_amount BIGINT,

  -- 주요 제품·서비스: AI 상담 컨텍스트 및 업종 세분화에 활용
  ADD COLUMN IF NOT EXISTS main_products TEXT;

-- 인덱스: 수출 여부로 프로그램 필터링 시 활용
CREATE INDEX IF NOT EXISTS idx_bp_has_export ON business_profiles(has_export);
CREATE INDEX IF NOT EXISTS idx_bp_entity_type ON business_profiles(business_entity_type);

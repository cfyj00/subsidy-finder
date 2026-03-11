-- =====================================================
-- 009_multi_profile.sql
-- 다중 사업 프로필 지원
-- =====================================================

-- ─── 1. business_profiles.user_id 유니크 제약 제거 ──
-- 한 사용자가 여러 사업체 프로필을 가질 수 있도록
ALTER TABLE business_profiles DROP CONSTRAINT IF EXISTS business_profiles_user_id_key;

-- ─── 2. profile_name 컬럼 추가 ────────────────────
-- 프로필 구분용 별칭 (예: "본사", "2공장", "농장 사업체")
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS profile_name TEXT;

-- ─── 3. profiles에 active_business_profile_id 추가 ─
-- 현재 활성 프로필 (매칭/AI 상담에 사용)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_business_profile_id UUID
  REFERENCES business_profiles(id) ON DELETE SET NULL;

-- ─── 안내 ────────────────────────────────────────────
-- 실행 후 Supabase SQL 에디터에서 아래 쿼리로 확인:
-- SELECT id, user_id, business_name, profile_name FROM business_profiles;
-- SELECT id, active_business_profile_id FROM profiles;

-- =====================================================
-- 001_core_schema.sql
-- 정부지원사업 도우미 - 핵심 스키마
-- =====================================================

-- ─── 1. PROFILES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       TEXT,
  phone              TEXT,
  is_premium         BOOLEAN NOT NULL DEFAULT false,
  onboarding_done    BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);


-- ─── 2. BUSINESS PROFILES ────────────────────────────
CREATE TABLE IF NOT EXISTS business_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name         TEXT NOT NULL,
  business_reg_number   TEXT,
  representative_name   TEXT,
  business_type         TEXT NOT NULL,
  business_category     TEXT,
  industry_code         TEXT,
  region_sido           TEXT NOT NULL,
  region_sigungu        TEXT,
  employee_count        INTEGER,
  annual_revenue        BIGINT,
  establishment_date    DATE,
  company_age_years     INTEGER,
  is_venture            BOOLEAN DEFAULT false,
  is_innobiz            BOOLEAN DEFAULT false,
  is_mainbiz            BOOLEAN DEFAULT false,
  has_smart_factory     BOOLEAN DEFAULT false,
  smart_factory_level   TEXT,
  current_challenges    TEXT[] DEFAULT '{}',
  goals                 TEXT[] DEFAULT '{}',
  previous_subsidies    JSONB DEFAULT '[]',
  notes                 TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_profiles_user ON business_profiles(user_id);

DROP POLICY IF EXISTS "bp_select" ON business_profiles;
DROP POLICY IF EXISTS "bp_insert" ON business_profiles;
DROP POLICY IF EXISTS "bp_update" ON business_profiles;
DROP POLICY IF EXISTS "bp_delete" ON business_profiles;
CREATE POLICY "bp_select" ON business_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bp_insert" ON business_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bp_update" ON business_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bp_delete" ON business_profiles FOR DELETE USING (auth.uid() = user_id);

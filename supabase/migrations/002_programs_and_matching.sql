-- =====================================================
-- 002_programs_and_matching.sql
-- 지원사업 프로그램 + 매칭 결과
-- =====================================================

-- ─── 1. PROGRAMS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id          TEXT UNIQUE,
  source               TEXT NOT NULL DEFAULT 'manual',
  title                TEXT NOT NULL,
  managing_org         TEXT,
  implementing_org     TEXT,
  category             TEXT NOT NULL,
  subcategory          TEXT,
  support_type         TEXT,
  target_industries    TEXT[] DEFAULT '{}',
  target_regions       TEXT[] DEFAULT '{}',
  target_company_size  TEXT[] DEFAULT '{}',
  min_employee_count   INTEGER,
  max_employee_count   INTEGER,
  min_revenue          BIGINT,
  max_revenue          BIGINT,
  min_company_age      INTEGER,
  max_company_age      INTEGER,
  funding_amount_min   BIGINT,
  funding_amount_max   BIGINT,
  self_funding_ratio   INTEGER,
  application_start    DATE,
  application_end      DATE,
  status               TEXT DEFAULT 'open',
  description          TEXT,
  eligibility_summary  TEXT,
  required_documents   TEXT[] DEFAULT '{}',
  detail_url           TEXT,
  raw_data             JSONB,
  is_featured          BOOLEAN DEFAULT false,
  last_synced_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs_select" ON programs FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
CREATE INDEX IF NOT EXISTS idx_programs_category ON programs(category);
CREATE INDEX IF NOT EXISTS idx_programs_end ON programs(application_end);
CREATE INDEX IF NOT EXISTS idx_programs_regions ON programs USING GIN(target_regions);
CREATE INDEX IF NOT EXISTS idx_programs_industries ON programs USING GIN(target_industries);


-- ─── 2. USER PROGRAM MATCHES ─────────────────────────
CREATE TABLE IF NOT EXISTS user_program_matches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id       UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  match_score      INTEGER NOT NULL,
  match_reasons    TEXT[] DEFAULT '{}',
  mismatch_reasons TEXT[] DEFAULT '{}',
  is_bookmarked    BOOLEAN DEFAULT false,
  is_dismissed     BOOLEAN DEFAULT false,
  calculated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

ALTER TABLE user_program_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_select" ON user_program_matches;
DROP POLICY IF EXISTS "matches_insert" ON user_program_matches;
DROP POLICY IF EXISTS "matches_update" ON user_program_matches;
DROP POLICY IF EXISTS "matches_delete" ON user_program_matches;
CREATE POLICY "matches_select" ON user_program_matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "matches_insert" ON user_program_matches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "matches_update" ON user_program_matches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "matches_delete" ON user_program_matches FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_matches_user ON user_program_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_score ON user_program_matches(match_score DESC);

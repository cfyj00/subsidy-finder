-- ─────────────────────────────────────────────────────────────────
-- Migration 010: 누락된 컬럼 추가
-- ─────────────────────────────────────────────────────────────────

-- 1. user_applications에 program_url 추가
ALTER TABLE user_applications
  ADD COLUMN IF NOT EXISTS program_url TEXT;

-- 2. user_program_matches에 applied_at, notes 추가
ALTER TABLE user_program_matches
  ADD COLUMN IF NOT EXISTS applied_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes       TEXT;

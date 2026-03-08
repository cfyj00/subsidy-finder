-- ─────────────────────────────────────────────────────────────────
-- Migration 006: 지원 관리 (user_applications)
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_applications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 연결된 프로그램 (없을 수도 있음 — 직접 입력)
  program_id            UUID        REFERENCES programs(id) ON DELETE SET NULL,
  -- 기본 정보
  program_title         TEXT        NOT NULL,
  managing_org          TEXT,
  application_deadline  DATE,
  -- 지원 금액 (단위: 만원)
  applied_amount        BIGINT,    -- 신청 금액 (만원)
  result_amount         BIGINT,    -- 확정 금액 (만원, 합격 시)
  -- 파이프라인 상태
  status                TEXT        NOT NULL DEFAULT 'preparing'
    CHECK (status IN ('preparing', 'submitted', 'reviewing', 'approved', 'rejected')),
  -- 날짜
  submitted_at          TIMESTAMPTZ,
  result_at             TIMESTAMPTZ,
  -- 자유 메모
  notes                 TEXT,
  -- 시스템
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE user_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own applications"
  ON user_applications FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON user_applications
  FOR EACH ROW EXECUTE FUNCTION update_applications_updated_at();

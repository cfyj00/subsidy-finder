-- =====================================================
-- 008_recurring_programs.sql
-- 연간 반복 사업 (작년 사업 기준 올해 출시 예상) 지원
-- =====================================================

-- programs 테이블에 반복 사업 컬럼 추가
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS is_recurring        BOOLEAN DEFAULT false,    -- 매년 반복되는 사업인지
  ADD COLUMN IF NOT EXISTS typical_open_month  INTEGER,                  -- 보통 모집 시작 월 (1-12)
  ADD COLUMN IF NOT EXISTS typical_duration_weeks INTEGER,               -- 보통 모집 기간 (주)
  ADD COLUMN IF NOT EXISTS last_active_year    INTEGER;                  -- 마지막으로 운영된 연도

-- status 컬럼은 이미 TEXT이므로 'expected' 값을 추가로 허용
-- (open, upcoming, closed, always, expected)
-- 'expected' = 작년 사업 기준 올해 출시 예상, 아직 공고 없음

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_programs_recurring ON programs(is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_programs_expected  ON programs(status)       WHERE status = 'expected';

-- =====================================================
-- 007_notifications.sql
-- 알림 시스템
-- =====================================================

-- ─── 1. NOTIFICATIONS ──────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,          -- 'deadline' | 'new_match' | 'status_change' | 'tip'
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  link        TEXT,                   -- 클릭 시 이동할 경로
  program_id  UUID REFERENCES programs(id) ON DELETE SET NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);


-- ─── 2. NOTIFICATION 자동 생성: 마감 임박 ──────────────────────────────
-- Supabase pg_cron 또는 외부 크론으로 매일 실행하거나,
-- /api/cron/notify-deadlines 라우트에서 수동 처리합니다.


-- ─── 3. 알림 읽음 처리 함수 ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_notifications_read(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = p_user_id AND is_read = false;
END;
$$;

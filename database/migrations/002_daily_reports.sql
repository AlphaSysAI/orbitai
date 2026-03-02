-- ============================================
-- OpenClaw – Rapports journaliers (échange inbox/reports)
-- ============================================
-- Exécuter dans Supabase SQL Editor après 001_openclaw_validation.sql
-- ============================================

CREATE TABLE IF NOT EXISTS daily_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  source_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_user_id ON daily_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date ON daily_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_created_at ON daily_reports(created_at DESC);

ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own daily reports" ON daily_reports;
CREATE POLICY "Users can view their own daily reports"
  ON daily_reports FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT réservé au worker (service_role).

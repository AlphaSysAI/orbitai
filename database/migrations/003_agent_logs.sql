-- ============================================
-- agent_logs – Logs des actions agent (append-only)
-- ============================================
-- Exécuter après 001_openclaw_validation.sql
-- RLS : chaque utilisateur ne voit que ses propres lignes.
-- ============================================

CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_user_id ON agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_action_type ON agent_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_logs(created_at DESC);

ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own agent_logs" ON agent_logs;
CREATE POLICY "Users can view own agent_logs"
  ON agent_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own agent_logs" ON agent_logs;
CREATE POLICY "Users can insert own agent_logs"
  ON agent_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

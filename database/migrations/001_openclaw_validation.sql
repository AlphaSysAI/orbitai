-- ============================================
-- OpenClaw – File de validation (Human-in-the-Loop) et index RAG
-- ============================================
-- Exécuter dans Supabase SQL Editor après init.sql
-- Les actions pending_validation vont dans validation_queue.
-- Les actions executed (ou approuvées) vont dans agent_actions_index (alimente le RAG).
-- ============================================

-- Table: validation_queue (tâches en attente de validation humaine)
CREATE TABLE IF NOT EXISTS validation_queue (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT NOT NULL DEFAULT '',
  human_input_required BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  raw_log_line JSONB,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_queue_user_id ON validation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_validation_queue_event_id ON validation_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_validation_queue_status ON validation_queue(status);
CREATE INDEX IF NOT EXISTS idx_validation_queue_created_at ON validation_queue(created_at DESC);

ALTER TABLE validation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own validation queue" ON validation_queue;
CREATE POLICY "Users can view their own validation queue"
  ON validation_queue FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own validation queue" ON validation_queue;
CREATE POLICY "Users can update their own validation queue"
  ON validation_queue FOR UPDATE
  USING (auth.uid() = user_id);

-- INSERT sur validation_queue : réservé au worker (clé service_role Supabase, contourne RLS).

-- Table: agent_actions_index (mémoire RAG – uniquement actions exécutées ou approuvées)
CREATE TABLE IF NOT EXISTS agent_actions_index (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT NOT NULL DEFAULT '',
  full_text TEXT NOT NULL DEFAULT '',
  source_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_index_user_id ON agent_actions_index(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_index_event_id ON agent_actions_index(event_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_index_created_at ON agent_actions_index(created_at DESC);

ALTER TABLE agent_actions_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own agent actions" ON agent_actions_index;
CREATE POLICY "Users can view their own agent actions"
  ON agent_actions_index FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT sur agent_actions_index : réservé au worker (clé service_role).

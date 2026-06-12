-- ============================================
-- OpenClaw – Database-first (remplace file-based inbox/outbox/skills)
-- ============================================
-- executed_at : worker marque les tâches approuvées comme exécutées (plus d'outbox fichier).
-- inbox_* : files d'attente en base (remplace data/exchange/inbox/*).
-- skill_manifests : skills en base (remplace data/skills/ et inbox/skills).
-- ============================================

-- validation_queue : marquer l'exécution (worker ne lit plus l'outbox fichier)
ALTER TABLE validation_queue
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

-- Inbox : événements bruts agent (remplace logs/daily/*.json)
CREATE TABLE IF NOT EXISTS inbox_agent_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('executed', 'pending_validation', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT NOT NULL DEFAULT '',
  human_input_required BOOLEAN NOT NULL DEFAULT true,
  raw_line JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inbox_agent_logs_processed ON inbox_agent_logs(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inbox_agent_logs_created ON inbox_agent_logs(created_at ASC);

ALTER TABLE inbox_agent_logs ENABLE ROW LEVEL SECURITY;
-- INSERT/SELECT réservés au worker (service_role).

-- Inbox : rapports journaliers (remplace inbox/reports fichiers)
CREATE TABLE IF NOT EXISTS inbox_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inbox_reports_processed ON inbox_reports(processed_at) WHERE processed_at IS NULL;

ALTER TABLE inbox_reports ENABLE ROW LEVEL SECURITY;

-- Inbox : demandes de validation (remplace inbox/validation fichiers)
CREATE TABLE IF NOT EXISTS inbox_validation (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT NOT NULL DEFAULT '',
  human_input_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inbox_validation_processed ON inbox_validation(processed_at) WHERE processed_at IS NULL;

ALTER TABLE inbox_validation ENABLE ROW LEVEL SECURITY;

-- Skills en base (remplace data/skills/ et inbox/skills)
CREATE TABLE IF NOT EXISTS skill_manifests (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL DEFAULT '0',
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(action_type)
);

CREATE INDEX IF NOT EXISTS idx_skill_manifests_action_type ON skill_manifests(action_type);

ALTER TABLE skill_manifests ENABLE ROW LEVEL SECURITY;

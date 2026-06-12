-- Configuration de la base de données pour Détection & Automatisation
-- Exécutez cette requête dans votre console Supabase SQL Editor

-- Table des tâches grises détectées
CREATE TABLE IF NOT EXISTS gray_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL CHECK (source IN ('document', 'history', 'manual', 'external')),
  frequency_score INTEGER DEFAULT 0, -- Score de fréquence (0-100)
  repetitiveness_score INTEGER DEFAULT 0, -- Score de répétitivité (0-100)
  time_estimate_minutes INTEGER, -- Estimation du temps passé
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'analyzing', 'automating', 'automated', 'ignored')),
  metadata JSONB DEFAULT '{}'::jsonb, -- Données contextuelles selon la source
  ai_analysis TEXT, -- Analyse de l'IA sur cette tâche
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des automatisations
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('email', 'file', 'webhook', 'internal', 'custom')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived', 'error')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Configuration du déclencheur
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Configuration de l'action
  conditions JSONB DEFAULT '[]'::jsonb, -- Conditions à vérifier
  related_task_id TEXT REFERENCES gray_tasks(id) ON DELETE SET NULL, -- Tâche grise liée
  ai_suggested BOOLEAN DEFAULT false, -- Si suggéré par l'IA
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table de l'historique d'exécution
CREATE TABLE IF NOT EXISTS automation_executions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input_data JSONB DEFAULT '{}'::jsonb, -- Données d'entrée
  output_data JSONB DEFAULT '{}'::jsonb, -- Données de sortie
  error_message TEXT,
  logs TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_gray_tasks_user_id ON gray_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_gray_tasks_status ON gray_tasks(status);
CREATE INDEX IF NOT EXISTS idx_gray_tasks_detected_at ON gray_tasks(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_automations_user_id ON automations(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);
CREATE INDEX IF NOT EXISTS idx_automations_next_execution ON automations(next_execution_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_automation_executions_automation_id ON automation_executions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_user_id ON automation_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_started_at ON automation_executions(started_at DESC);

-- Politiques RLS (Row Level Security)
ALTER TABLE gray_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

-- Politiques pour gray_tasks
CREATE POLICY "Users can view their own gray tasks"
  ON gray_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own gray tasks"
  ON gray_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gray tasks"
  ON gray_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gray tasks"
  ON gray_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Politiques pour automations
CREATE POLICY "Users can view their own automations"
  ON automations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own automations"
  ON automations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own automations"
  ON automations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own automations"
  ON automations FOR DELETE
  USING (auth.uid() = user_id);

-- Politiques pour automation_executions
CREATE POLICY "Users can view their own automation executions"
  ON automation_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own automation executions"
  ON automation_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Table pour suivre l'historique des actions utilisateur (pour détection future)
CREATE TABLE IF NOT EXISTS user_actions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'document_upload', 'message_sent', 'task_created', etc.
  metadata JSONB DEFAULT '{}'::jsonb, -- Détails de l'action
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_type ON user_actions(action_type);

-- Politiques RLS pour user_actions
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own actions"
  ON user_actions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own actions"
  ON user_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);


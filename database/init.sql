-- ============================================
-- ORBITAI - INITIALISATION COMPLÈTE DE LA BASE DE DONNÉES
-- ============================================
-- Ce script initialise toutes les tables nécessaires pour OrbitAI,
-- y compris OpenClaw (validation, inbox database-first, auto-pilot).
-- Inclut le contenu des migrations 001 à 005.
-- Exécutez ce script dans votre console Supabase SQL Editor
-- (ou reset.sql puis init.sql pour repartir de zéro).
-- ============================================

-- ============================================
-- 1. PILIER: COPILOTE IA & TRANSMISSION
-- ============================================

-- Table: documents (Base de connaissances)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar_id TEXT NOT NULL DEFAULT 'copilot-transmission',
  name TEXT NOT NULL,
  full_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour documents
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_pillar_id ON documents(pillar_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_pillar ON documents(user_id, pillar_id);

-- RLS pour documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
CREATE POLICY "Users can insert their own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;
CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Table: threads (Conversations Copilot)
-- Table: threads (Conversations)
CREATE TABLE IF NOT EXISTS threads (
  id_thread TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration : Si id_thread est UUID dans la table existante, convertir en TEXT pour cohérence
DO $$
DECLARE
  fk_constraint_name TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'threads' 
    AND column_name = 'id_thread' 
    AND data_type = 'uuid'
  ) THEN
    -- Supprimer temporairement les foreign keys qui référencent threads.id_thread
    FOR fk_constraint_name IN
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' 
      AND table_name IN ('messages', 'message_feedback')
      AND constraint_name IN (
        SELECT constraint_name 
        FROM information_schema.key_column_usage 
        WHERE column_name = 'thread_id' 
        AND table_name IN ('messages', 'message_feedback')
      )
    LOOP
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
          EXECUTE 'ALTER TABLE messages DROP CONSTRAINT IF EXISTS ' || quote_ident(fk_constraint_name);
        END IF;
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'message_feedback') THEN
          EXECUTE 'ALTER TABLE message_feedback DROP CONSTRAINT IF EXISTS ' || quote_ident(fk_constraint_name);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Ignorer les erreurs de contrainte inexistante
        NULL;
      END;
    END LOOP;
    
    -- Convertir threads.id_thread de UUID à TEXT
    ALTER TABLE threads ALTER COLUMN id_thread TYPE TEXT USING id_thread::text;
    
    -- Convertir messages.thread_id si nécessaire
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages') THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'thread_id' 
        AND data_type = 'uuid'
      ) THEN
        ALTER TABLE messages ALTER COLUMN thread_id TYPE TEXT USING thread_id::text;
      END IF;
    END IF;
  END IF;
END $$;

-- Index pour threads
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at DESC);

-- RLS pour threads
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own threads" ON threads;
CREATE POLICY "Users can view their own threads"
  ON threads FOR SELECT
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert their own threads" ON threads;
CREATE POLICY "Users can insert their own threads"
  ON threads FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update their own threads" ON threads;
CREATE POLICY "Users can update their own threads"
  ON threads FOR UPDATE
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete their own threads" ON threads;
CREATE POLICY "Users can delete their own threads"
  ON threads FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Table: messages (Messages des conversations)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL REFERENCES threads(id_thread) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour messages
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- RLS pour messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Users can view their own messages"
  ON messages FOR SELECT
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
CREATE POLICY "Users can insert their own messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages"
  ON messages FOR UPDATE
  USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages"
  ON messages FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- ============================================
-- 2. PILIER: SIMULATION DÉCISIONNELLE
-- ============================================

-- Table: decision_simulations
CREATE TABLE IF NOT EXISTS decision_simulations (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('conversation', 'analyzing', 'ready', 'saved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context JSONB DEFAULT '{}'::jsonb,
  conversation JSONB DEFAULT '[]'::jsonb,
  scenarios JSONB DEFAULT '[]'::jsonb,
  selected_scenarios TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Index pour decision_simulations
CREATE INDEX IF NOT EXISTS idx_decision_simulations_user_id ON decision_simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_simulations_updated_at ON decision_simulations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_simulations_status ON decision_simulations(status);

-- RLS pour decision_simulations
ALTER TABLE decision_simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own simulations" ON decision_simulations;
CREATE POLICY "Users can view their own simulations"
  ON decision_simulations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own simulations" ON decision_simulations;
CREATE POLICY "Users can create their own simulations"
  ON decision_simulations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own simulations" ON decision_simulations;
CREATE POLICY "Users can update their own simulations"
  ON decision_simulations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own simulations" ON decision_simulations;
CREATE POLICY "Users can delete their own simulations"
  ON decision_simulations FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. PILIER: DÉTECTION & AUTOMATISATION
-- ============================================

-- Table: gray_tasks (Tâches grises détectées)
CREATE TABLE IF NOT EXISTS gray_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL CHECK (source IN ('document', 'history', 'manual', 'external')),
  frequency_score INTEGER DEFAULT 0,
  repetitiveness_score INTEGER DEFAULT 0,
  time_estimate_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'analyzing', 'automating', 'automated', 'ignored')),
  metadata JSONB DEFAULT '{}'::jsonb,
  ai_analysis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: automations
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('email', 'file', 'webhook', 'internal', 'custom')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived', 'error')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB DEFAULT '[]'::jsonb,
  related_task_id TEXT REFERENCES gray_tasks(id) ON DELETE SET NULL,
  ai_suggested BOOLEAN DEFAULT false,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: automation_executions
CREATE TABLE IF NOT EXISTS automation_executions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  logs TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Table: user_actions (Historique des actions pour détection)
CREATE TABLE IF NOT EXISTS user_actions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour gray_tasks
CREATE INDEX IF NOT EXISTS idx_gray_tasks_user_id ON gray_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_gray_tasks_status ON gray_tasks(status);
CREATE INDEX IF NOT EXISTS idx_gray_tasks_detected_at ON gray_tasks(detected_at DESC);

-- Index pour automations
CREATE INDEX IF NOT EXISTS idx_automations_user_id ON automations(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);
CREATE INDEX IF NOT EXISTS idx_automations_next_execution ON automations(next_execution_at) WHERE status = 'active';

-- Index pour automation_executions
CREATE INDEX IF NOT EXISTS idx_automation_executions_automation_id ON automation_executions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_user_id ON automation_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_started_at ON automation_executions(started_at DESC);

-- Index pour user_actions
CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_type ON user_actions(action_type);

-- RLS pour gray_tasks
ALTER TABLE gray_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own gray tasks" ON gray_tasks;
CREATE POLICY "Users can view their own gray tasks"
  ON gray_tasks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own gray tasks" ON gray_tasks;
CREATE POLICY "Users can create their own gray tasks"
  ON gray_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own gray tasks" ON gray_tasks;
CREATE POLICY "Users can update their own gray tasks"
  ON gray_tasks FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own gray tasks" ON gray_tasks;
CREATE POLICY "Users can delete their own gray tasks"
  ON gray_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- RLS pour automations
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own automations" ON automations;
CREATE POLICY "Users can view their own automations"
  ON automations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own automations" ON automations;
CREATE POLICY "Users can create their own automations"
  ON automations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own automations" ON automations;
CREATE POLICY "Users can update their own automations"
  ON automations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own automations" ON automations;
CREATE POLICY "Users can delete their own automations"
  ON automations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS pour automation_executions
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own automation executions" ON automation_executions;
CREATE POLICY "Users can view their own automation executions"
  ON automation_executions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own automation executions" ON automation_executions;
CREATE POLICY "Users can create their own automation executions"
  ON automation_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS pour user_actions
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own actions" ON user_actions;
CREATE POLICY "Users can view their own actions"
  ON user_actions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own actions" ON user_actions;
CREATE POLICY "Users can create their own actions"
  ON user_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- MIGRATIONS POUR TABLES EXISTANTES
-- ============================================
-- Ces migrations sont idempotentes (sûres à exécuter plusieurs fois)

-- Migration: Ajouter created_at à documents si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE documents ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    UPDATE documents SET created_at = NOW() WHERE created_at IS NULL;
  END IF;
END $$;

-- Migration: Ajouter pillar_id à documents si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'pillar_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN pillar_id TEXT;
    UPDATE documents SET pillar_id = 'copilot-transmission' WHERE pillar_id IS NULL;
    ALTER TABLE documents ALTER COLUMN pillar_id SET NOT NULL;
    ALTER TABLE documents ALTER COLUMN pillar_id SET DEFAULT 'copilot-transmission';
    
    -- Créer les index si nécessaire
    CREATE INDEX IF NOT EXISTS idx_documents_pillar_id ON documents(pillar_id);
    CREATE INDEX IF NOT EXISTS idx_documents_user_pillar ON documents(user_id, pillar_id);
  END IF;
END $$;

-- ============================================
-- 4. SYSTÈME D'APPRENTISSAGE ET PERSONNALISATION PAR UTILISATEUR
-- ============================================

-- Table: user_preferences (Préférences et profil d'apprentissage de chaque utilisateur)
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Préférences de style de réponse (apprises automatiquement)
  preferred_style TEXT DEFAULT 'balanced' CHECK (preferred_style IN ('concise', 'detailed', 'balanced', 'technical', 'pedagogical')),
  preferred_tone TEXT DEFAULT 'professional' CHECK (preferred_tone IN ('formal', 'casual', 'professional', 'friendly')),
  preferred_detail_level INTEGER DEFAULT 5 CHECK (preferred_detail_level >= 1 AND preferred_detail_level <= 10),
  
  -- Niveau d'expertise perçu (calculé automatiquement)
  perceived_expertise_level TEXT DEFAULT 'intermediate' CHECK (perceived_expertise_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  
  -- Statistiques d'apprentissage
  total_interactions INTEGER DEFAULT 0,
  positive_feedback_count INTEGER DEFAULT 0,
  negative_feedback_count INTEGER DEFAULT 0,
  feedback_score DECIMAL(5,2) DEFAULT 0.0, -- Score de 0 à 1
  
  -- Préférences apprises (stockées en JSON pour flexibilité)
  learned_preferences JSONB DEFAULT '{}'::jsonb, -- Ex: {"favor_short_answers": true, "prefer_examples": true}
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_learning_update TIMESTAMPTZ
);

-- Table: message_feedback (Feedback utilisateur sur les réponses de l'IA)
-- Gestion intelligente du type thread_id selon le type de threads.id_thread
DO $$
DECLARE
  threads_id_type TEXT;
  table_exists BOOLEAN;
  column_exists BOOLEAN;
  column_type TEXT;
BEGIN
  -- Vérifier si threads existe et quel est le type de id_thread
  SELECT data_type INTO threads_id_type
  FROM information_schema.columns 
  WHERE table_name = 'threads' 
  AND column_name = 'id_thread';
  
  -- Vérifier si message_feedback existe déjà
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'message_feedback'
  ) INTO table_exists;
  
  -- Si la table n'existe pas, la créer avec le bon type
  IF NOT table_exists THEN
    IF threads_id_type = 'uuid' THEN
      -- Créer avec UUID
      CREATE TABLE message_feedback (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        message_id TEXT NOT NULL,
        thread_id UUID,
        feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'correction')),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        correction_text TEXT,
        message_content TEXT,
        user_context JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    ELSE
      -- Créer avec TEXT (ou si threads n'existe pas encore)
      CREATE TABLE message_feedback (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        message_id TEXT NOT NULL,
        thread_id TEXT,
        feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative', 'correction')),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        correction_text TEXT,
        message_content TEXT,
        user_context JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    END IF;
  ELSE
    -- La table existe, vérifier et convertir si nécessaire
    SELECT data_type INTO column_type
    FROM information_schema.columns 
    WHERE table_name = 'message_feedback' 
    AND column_name = 'thread_id';
    
    -- Si types incompatibles, convertir
    IF threads_id_type = 'uuid' AND column_type = 'text' THEN
      -- Supprimer la contrainte existante si elle existe
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'message_feedback_thread_id_fkey'
      ) THEN
        ALTER TABLE message_feedback DROP CONSTRAINT message_feedback_thread_id_fkey;
      END IF;
      
      -- Convertir TEXT vers UUID (les valeurs invalides deviendront NULL)
      ALTER TABLE message_feedback 
      ALTER COLUMN thread_id TYPE UUID 
      USING CASE 
        WHEN thread_id IS NULL THEN NULL
        WHEN thread_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN thread_id::uuid
        ELSE NULL
      END;
    ELSIF threads_id_type = 'text' AND column_type = 'uuid' THEN
      -- Supprimer la contrainte existante si elle existe
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'message_feedback_thread_id_fkey'
      ) THEN
        ALTER TABLE message_feedback DROP CONSTRAINT message_feedback_thread_id_fkey;
      END IF;
      
      -- Convertir UUID vers TEXT
      ALTER TABLE message_feedback 
      ALTER COLUMN thread_id TYPE TEXT 
      USING thread_id::text;
    END IF;
  END IF;
  
  -- Ajouter la foreign key si threads existe et si la contrainte n'existe pas déjà
  IF threads_id_type IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'message_feedback_thread_id_fkey'
      AND table_name = 'message_feedback'
    ) THEN
      ALTER TABLE message_feedback 
      ADD CONSTRAINT message_feedback_thread_id_fkey 
      FOREIGN KEY (thread_id) REFERENCES threads(id_thread) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Index pour user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Index pour message_feedback
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_thread_id ON message_feedback(thread_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_created_at ON message_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_feedback_type ON message_feedback(feedback_type);

-- RLS pour user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS pour message_feedback
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own feedback" ON message_feedback;
CREATE POLICY "Users can view their own feedback"
  ON message_feedback FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own feedback" ON message_feedback;
CREATE POLICY "Users can insert their own feedback"
  ON message_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Fonction pour mettre à jour automatiquement les préférences basées sur le feedback
CREATE OR REPLACE FUNCTION update_user_preferences_from_feedback()
RETURNS TRIGGER AS $$
DECLARE
  feedback_score_calc DECIMAL(5,2);
  total_interactions_count INTEGER;
  positive_count INTEGER;
  negative_count INTEGER;
BEGIN
  -- Calculer les statistiques actuelles
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE feedback_type = 'positive'),
    COUNT(*) FILTER (WHERE feedback_type = 'negative')
  INTO total_interactions_count, positive_count, negative_count
  FROM message_feedback
  WHERE user_id = NEW.user_id;
  
  -- Calculer le score de feedback (0-1)
  IF total_interactions_count > 0 THEN
    feedback_score_calc := (positive_count::DECIMAL / total_interactions_count::DECIMAL);
  ELSE
    feedback_score_calc := 0.5;
  END IF;
  
  -- Insérer ou mettre à jour les préférences
  INSERT INTO user_preferences (user_id, total_interactions, positive_feedback_count, negative_feedback_count, feedback_score, updated_at, last_learning_update)
  VALUES (NEW.user_id, total_interactions_count, positive_count, negative_count, feedback_score_calc, NOW(), NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    total_interactions = total_interactions_count,
    positive_feedback_count = positive_count,
    negative_feedback_count = negative_count,
    feedback_score = feedback_score_calc,
    updated_at = NOW(),
    last_learning_update = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement les préférences lors d'un nouveau feedback
CREATE TRIGGER trigger_update_preferences_on_feedback
  AFTER INSERT ON message_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_from_feedback();

-- ============================================
-- 5. PILIER: SYNTHÈSE INTELLIGENTE CLIENT (Marketing & Communication)
-- ============================================

-- Table: client_feedback_sources (Sources de retours clients)
CREATE TABLE IF NOT EXISTS client_feedback_sources (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Informations sur la source
  source_type TEXT NOT NULL CHECK (source_type IN ('email', 'ticket', 'review', 'survey', 'social', 'interview', 'chat', 'call', 'other')),
  source_name TEXT NOT NULL, -- Nom de la source (ex: "Trustpilot", "Zendesk", "Instagram")
  source_identifier TEXT, -- Identifiant externe si applicable
  
  -- Métadonnées
  total_items INTEGER DEFAULT 0, -- Nombre d'items collectés depuis cette source
  last_sync_at TIMESTAMPTZ, -- Dernière synchronisation
  sync_config JSONB DEFAULT '{}'::jsonb, -- Configuration de synchronisation (credentials, etc.)
  
  -- Surveillance automatique
  monitoring_url TEXT, -- URL à surveiller (ex: page Google Reviews, Trustpilot, etc.)
  auto_monitoring BOOLEAN DEFAULT false, -- Activer la surveillance automatique
  monitoring_frequency TEXT DEFAULT 'daily' CHECK (monitoring_frequency IN ('hourly', 'daily', 'weekly')), -- Fréquence de surveillance
  
  -- Statistiques
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: client_feedback_items (Retours clients individuels)
CREATE TABLE IF NOT EXISTS client_feedback_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES client_feedback_sources(id) ON DELETE CASCADE,
  
  -- Contenu du retour
  content TEXT NOT NULL, -- Contenu original du retour
  summary TEXT, -- Résumé généré par l'IA
  raw_data JSONB DEFAULT '{}'::jsonb, -- Données brutes originales
  
  -- Métadonnées du retour
  client_id TEXT, -- Identifiant du client (si disponible)
  client_email TEXT,
  client_name TEXT,
  channel TEXT, -- Canal (ex: "email", "chat", "review_platform")
  
  -- Classification
  category TEXT, -- Catégorie (ex: "bug", "feature_request", "complaint", "praise")
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score DECIMAL(3,2), -- Score de sentiment (-1 à 1)
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Note/rating (1-5 étoiles) pour les avis
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  topic_tags TEXT[] DEFAULT ARRAY[]::TEXT[], -- Tags de sujets identifiés
  
  -- Informations temporelles
  feedback_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Date du retour client
  processed_at TIMESTAMPTZ, -- Date de traitement par l'IA
  
  -- Lien vers l'analyse
  analysis_id TEXT, -- ID de l'analyse qui a traité ce retour
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: marketing_analysis (Analyses marketing/com générées)
CREATE TABLE IF NOT EXISTS marketing_analysis (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Type d'analyse
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('full', 'thematic', 'periodic', 'custom')),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  
  -- Résultats de l'analyse
  weaknesses JSONB DEFAULT '[]'::jsonb, -- Faiblesses identifiées
  strengths JSONB DEFAULT '[]'::jsonb, -- Forces identifiées
  levers JSONB DEFAULT '[]'::jsonb, -- Leviers marketing/com identifiés
  opportunities JSONB DEFAULT '[]'::jsonb, -- Opportunités
  threats JSONB DEFAULT '[]'::jsonb, -- Menaces
  
  -- Insights structurés
  key_insights JSONB DEFAULT '[]'::jsonb, -- Insights clés
  recommendations JSONB DEFAULT '[]'::jsonb, -- Recommandations actionnables
  trends JSONB DEFAULT '{}'::jsonb, -- Tendances détectées
  
  -- Métriques globales
  overall_sentiment DECIMAL(3,2), -- Sentiment global (-1 à 1)
  satisfaction_score DECIMAL(3,2), -- Score de satisfaction (0 à 1)
  nps_score DECIMAL(5,2), -- Net Promoter Score estimé
  top_themes JSONB DEFAULT '[]'::jsonb, -- Thèmes les plus mentionnés
  
  -- Statistiques
  total_feedback_analyzed INTEGER DEFAULT 0,
  positive_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  
  -- Statut
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'archived')),
  
  -- Comparaison temporelle
  previous_analysis_id TEXT, -- Référence à l'analyse précédente pour comparaison
  comparison_data JSONB DEFAULT '{}'::jsonb, -- Données de comparaison avec l'analyse précédente
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Foreign key pour la comparaison
  CONSTRAINT fk_previous_analysis FOREIGN KEY (previous_analysis_id) REFERENCES marketing_analysis(id) ON DELETE SET NULL
);

-- Index pour client_feedback_sources
CREATE INDEX IF NOT EXISTS idx_client_feedback_sources_user_id ON client_feedback_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_sources_type ON client_feedback_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_client_feedback_sources_active ON client_feedback_sources(is_active) WHERE is_active = true;

-- Index pour client_feedback_items
CREATE INDEX IF NOT EXISTS idx_client_feedback_items_user_id ON client_feedback_items(user_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_items_source_id ON client_feedback_items(source_id);
CREATE INDEX IF NOT EXISTS idx_client_feedback_items_sentiment ON client_feedback_items(sentiment);
CREATE INDEX IF NOT EXISTS idx_client_feedback_items_category ON client_feedback_items(category);
CREATE INDEX IF NOT EXISTS idx_client_feedback_items_feedback_date ON client_feedback_items(feedback_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_feedback_items_analysis_id ON client_feedback_items(analysis_id);

-- Migration: Ajouter les colonnes de comparaison temporelle à marketing_analysis
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'marketing_analysis'
  ) THEN
    -- Ajouter previous_analysis_id si elle n'existe pas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'marketing_analysis' AND column_name = 'previous_analysis_id'
    ) THEN
      ALTER TABLE marketing_analysis ADD COLUMN previous_analysis_id TEXT;
      
      -- Ajouter la contrainte de clé étrangère si elle n'existe pas
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'marketing_analysis' AND constraint_name = 'fk_previous_analysis'
      ) THEN
        ALTER TABLE marketing_analysis 
        ADD CONSTRAINT fk_previous_analysis 
        FOREIGN KEY (previous_analysis_id) 
        REFERENCES marketing_analysis(id) 
        ON DELETE SET NULL;
      END IF;
    END IF;

    -- Ajouter comparison_data si elle n'existe pas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'marketing_analysis' AND column_name = 'comparison_data'
    ) THEN
      ALTER TABLE marketing_analysis ADD COLUMN comparison_data JSONB DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END $$;

-- Index pour marketing_analysis
CREATE INDEX IF NOT EXISTS idx_marketing_analysis_user_id ON marketing_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_analysis_type ON marketing_analysis(analysis_type);
CREATE INDEX IF NOT EXISTS idx_marketing_analysis_status ON marketing_analysis(status);
CREATE INDEX IF NOT EXISTS idx_marketing_analysis_period ON marketing_analysis(period_start, period_end);

-- Migration : Ajouter la colonne rating à client_feedback_items si elle n'existe pas
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'client_feedback_items'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'client_feedback_items' AND column_name = 'rating'
    ) THEN
      ALTER TABLE client_feedback_items 
      ADD COLUMN rating INTEGER CHECK (rating >= 1 AND rating <= 5);
      
      -- Mettre à jour les notes existantes depuis raw_data si disponibles
      UPDATE client_feedback_items
      SET rating = (raw_data->>'rating')::INTEGER
      WHERE raw_data->>'rating' IS NOT NULL 
        AND (raw_data->>'rating')::INTEGER BETWEEN 1 AND 5;
    END IF;
  END IF;
END $$;

-- Migration: Ajouter les colonnes de surveillance automatique à client_feedback_sources
-- (Doit être exécutée APRÈS la création de la table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'client_feedback_sources'
  ) THEN
    -- Ajouter monitoring_url si elle n'existe pas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'client_feedback_sources' AND column_name = 'monitoring_url'
    ) THEN
      ALTER TABLE client_feedback_sources ADD COLUMN monitoring_url TEXT;
    END IF;

    -- Ajouter auto_monitoring si elle n'existe pas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'client_feedback_sources' AND column_name = 'auto_monitoring'
    ) THEN
      ALTER TABLE client_feedback_sources ADD COLUMN auto_monitoring BOOLEAN DEFAULT false;
    END IF;

    -- Ajouter monitoring_frequency si elle n'existe pas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'client_feedback_sources' AND column_name = 'monitoring_frequency'
    ) THEN
      ALTER TABLE client_feedback_sources ADD COLUMN monitoring_frequency TEXT DEFAULT 'daily';
      -- Ajouter la contrainte CHECK si elle n'existe pas
      BEGIN
        ALTER TABLE client_feedback_sources ADD CONSTRAINT client_feedback_sources_monitoring_frequency_check 
        CHECK (monitoring_frequency IN ('hourly', 'daily', 'weekly'));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END IF;
END $$;

-- RLS pour client_feedback_sources
ALTER TABLE client_feedback_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own feedback sources" ON client_feedback_sources;
CREATE POLICY "Users can view their own feedback sources"
  ON client_feedback_sources FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own feedback sources" ON client_feedback_sources;
CREATE POLICY "Users can insert their own feedback sources"
  ON client_feedback_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own feedback sources" ON client_feedback_sources;
CREATE POLICY "Users can update their own feedback sources"
  ON client_feedback_sources FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own feedback sources" ON client_feedback_sources;
CREATE POLICY "Users can delete their own feedback sources"
  ON client_feedback_sources FOR DELETE
  USING (auth.uid() = user_id);

-- RLS pour client_feedback_items
ALTER TABLE client_feedback_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own feedback items" ON client_feedback_items;
CREATE POLICY "Users can view their own feedback items"
  ON client_feedback_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own feedback items" ON client_feedback_items;
CREATE POLICY "Users can insert their own feedback items"
  ON client_feedback_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own feedback items" ON client_feedback_items;
CREATE POLICY "Users can update their own feedback items"
  ON client_feedback_items FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own feedback items" ON client_feedback_items;
CREATE POLICY "Users can delete their own feedback items"
  ON client_feedback_items FOR DELETE
  USING (auth.uid() = user_id);

-- RLS pour marketing_analysis
ALTER TABLE marketing_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own marketing analysis" ON marketing_analysis;
CREATE POLICY "Users can view their own marketing analysis"
  ON marketing_analysis FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own marketing analysis" ON marketing_analysis;
CREATE POLICY "Users can insert their own marketing analysis"
  ON marketing_analysis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own marketing analysis" ON marketing_analysis;
CREATE POLICY "Users can update their own marketing analysis"
  ON marketing_analysis FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own marketing analysis" ON marketing_analysis;
CREATE POLICY "Users can delete their own marketing analysis"
  ON marketing_analysis FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 6. AI REVIEW ENGINE + OpenClaw legacy (inbox, auto-pilot, agent index)
-- (migrations 001 à 005 + 007 ai_review_queue)
-- ============================================

-- Table: ai_review_queue (file de révision humaine — AI Review Engine)
CREATE TABLE IF NOT EXISTS ai_review_queue (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  review_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_type TEXT NOT NULL DEFAULT 'legacy_action' CHECK (review_type IN (
    'knowledge_concept',
    'knowledge_procedure',
    'knowledge_role',
    'knowledge_faq',
    'document_summary',
    'learning_path',
    'quiz',
    'expert_pattern',
    'automation_suggestion',
    'legacy_action'
  )),
  subject_type TEXT,
  subject_id TEXT,
  source_module TEXT,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  proposed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  published_at TIMESTAMPTZ,
  priority INT NOT NULL DEFAULT 0,
  review_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_review_queue_user_id ON ai_review_queue(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_review_queue_review_id ON ai_review_queue(review_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_status ON ai_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_created_at ON ai_review_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_review_type ON ai_review_queue(review_type);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_user_pending
  ON ai_review_queue(user_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE ai_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ai reviews" ON ai_review_queue;
CREATE POLICY "Users can view their own ai reviews"
  ON ai_review_queue FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own ai reviews" ON ai_review_queue;
CREATE POLICY "Users can update their own ai reviews"
  ON ai_review_queue FOR UPDATE
  USING (auth.uid() = user_id);

-- INSERT sur ai_review_queue : réservé au worker (clé service_role Supabase, contourne RLS).

COMMENT ON TABLE ai_review_queue IS
  'AI Review Engine — file de révision humaine (1 review = 1 artefact).';
COMMENT ON COLUMN ai_review_queue.review_id IS
  'Identifiant stable externe (ex-event_id OpenClaw).';
COMMENT ON COLUMN ai_review_queue.review_type IS
  'Type métier de la révision (Knowledge, Quiz, legacy_action, …).';
COMMENT ON COLUMN ai_review_queue.published_at IS
  'Horodatage publication post-approbation (ex-executed_at OpenClaw).';

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

-- Table: daily_reports (rapports journaliers)
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

-- Table: agent_logs (logs des actions agent, append-only)
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

-- Table: automation_policies (auto-pilot – une ligne par user_id + action_type)
CREATE TABLE IF NOT EXISTS automation_policies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DECLINED_50', 'DECLINED_100', 'ENABLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_automation_policies_user_id ON automation_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_policies_status ON automation_policies(status);

ALTER TABLE automation_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own automation policies" ON automation_policies;
CREATE POLICY "Users can view own automation policies"
  ON automation_policies FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own automation policies" ON automation_policies;
CREATE POLICY "Users can update own automation policies"
  ON automation_policies FOR UPDATE
  USING (auth.uid() = user_id);

-- INSERT réservé au service (création de la ligne PENDING quand success_count >= 50).

-- Vue : success_count par (user_id, action_type) à partir de agent_actions_index
-- security_invoker : RLS de l'utilisateur courant (pas SECURITY DEFINER)
DROP VIEW IF EXISTS v_user_action_success_count;

CREATE VIEW v_user_action_success_count
WITH (security_invoker = true)
AS
SELECT
  user_id,
  action AS action_type,
  COUNT(*)::integer AS success_count
FROM agent_actions_index
GROUP BY user_id, action;

-- Fonction : retourne success_count par action_type pour un user_id (déclenchement paliers auto-pilot)
CREATE OR REPLACE FUNCTION get_success_count_by_action(p_user_id UUID)
RETURNS TABLE(action_type TEXT, success_count INTEGER) AS $$
  SELECT action::TEXT AS action_type, COUNT(*)::INTEGER AS success_count
  FROM agent_actions_index
  WHERE user_id = p_user_id
  GROUP BY action;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON TABLE automation_policies IS 'Auto-Pilot: paliers 50 (PENDING -> ENABLED/DECLINED_50) et palier 2 (DECLINED_50 -> ENABLED/DECLINED_50). DECLINED_100 = révoqué.';
COMMENT ON VIEW v_user_action_success_count IS 'Nombre de succès (lignes agent_actions_index) par user_id et action_type. security_invoker.';
COMMENT ON FUNCTION get_success_count_by_action(UUID) IS 'Retourne le nombre de succès par action_type pour un utilisateur (déclenchement paliers Auto-Pilot).';

-- ============================================
-- MULTI-TENANT : organizations + modules (009)
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_first_name TEXT,
  manager_last_name TEXT,
  manager_email TEXT,
  business_sector TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_manager_email ON organizations(manager_email);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);

CREATE TABLE IF NOT EXISTS organization_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, module_name)
);

CREATE INDEX IF NOT EXISTS idx_organization_modules_org_id ON organization_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_modules_name ON organization_modules(module_name);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
CREATE POLICY "Members can view their organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own memberships" ON organization_members;
CREATE POLICY "Users can view own memberships"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can view org modules" ON organization_modules;
CREATE POLICY "Members can view org modules"
  ON organization_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_modules.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION org_has_module(
  p_organization_id UUID,
  p_module_name TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_modules om
    INNER JOIN organization_members mem
      ON mem.organization_id = om.organization_id
    WHERE om.organization_id = p_organization_id
      AND om.module_name = p_module_name
      AND om.is_enabled = true
      AND mem.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION get_my_enabled_modules()
RETURNS TABLE(
  organization_id UUID,
  module_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.organization_id, om.module_name
  FROM organization_modules om
  INNER JOIN organization_members mem
    ON mem.organization_id = om.organization_id
  WHERE mem.user_id = auth.uid()
    AND om.is_enabled = true
  ORDER BY om.module_name;
$$;

COMMENT ON TABLE organizations IS 'Tenant / organisation cliente OrbitAI.';
COMMENT ON TABLE organization_members IS 'Appartenance utilisateur à une organisation.';
COMMENT ON TABLE organization_modules IS 'Modules activés par organisation (ex: knowledge_base, regiaire_core).';
COMMENT ON FUNCTION org_has_module(UUID, TEXT) IS 'Vérifie si l''utilisateur courant a accès au module pour l''organisation.';
COMMENT ON FUNCTION get_my_enabled_modules() IS 'Modules activés pour l''utilisateur authentifié.';

-- ============================================
-- 7. RÉGIAIRE — Réception / Stock (013)
-- ============================================

CREATE OR REPLACE FUNCTION is_org_member(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION is_org_member(UUID) IS
  'True si l''utilisateur courant est membre de l''organisation.';

DO $$
BEGIN
  CREATE TYPE delivery_status AS ENUM (
    'draft',
    'scanning',
    'discrepancy',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_organization_id ON suppliers(organization_id);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ean TEXT NOT NULL,
  name TEXT NOT NULL,
  has_dlc BOOLEAN NOT NULL DEFAULT false,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, ean)
);

CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_products_org_ean ON products(organization_id, ean);

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status delivery_status NOT NULL DEFAULT 'draft',
  bl_file_path TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deliveries_organization_id ON deliveries(organization_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_supplier_id ON deliveries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

CREATE TABLE IF NOT EXISTS delivery_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  raw_name TEXT NOT NULL,
  ean TEXT,
  expected_qty INTEGER NOT NULL CHECK (expected_qty >= 0),
  scanned_qty INTEGER NOT NULL DEFAULT 0 CHECK (scanned_qty >= 0),
  dlc DATE,
  needs_review BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_delivery_lines_delivery_id ON delivery_lines(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_lines_ean ON delivery_lines(ean);
CREATE INDEX IF NOT EXISTS idx_delivery_lines_product_id ON delivery_lines(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_lines_delivery_ean_unique
  ON delivery_lines(delivery_id, ean);

CREATE TABLE IF NOT EXISTS stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  dlc DATE,
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE RESTRICT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_batches_organization_id ON stock_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_product_id ON stock_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_delivery_id ON stock_batches(delivery_id);

COMMENT ON TABLE suppliers IS 'Fournisseurs RégiAire par organisation.';
COMMENT ON TABLE products IS 'Catalogue produits (EAN) par organisation.';
COMMENT ON TABLE deliveries IS 'Bon de livraison (réception) RégiAire.';
COMMENT ON TABLE delivery_lines IS 'Lignes extraites / scannées d''un BL.';
COMMENT ON TABLE stock_batches IS 'Lots en stock issus d''une réception validée.';

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regiaire_suppliers_select" ON suppliers;
CREATE POLICY "regiaire_suppliers_select"
  ON suppliers FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_suppliers_insert" ON suppliers;
CREATE POLICY "regiaire_suppliers_insert"
  ON suppliers FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_suppliers_update" ON suppliers;
CREATE POLICY "regiaire_suppliers_update"
  ON suppliers FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_suppliers_delete" ON suppliers;
CREATE POLICY "regiaire_suppliers_delete"
  ON suppliers FOR DELETE
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_products_select" ON products;
CREATE POLICY "regiaire_products_select"
  ON products FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_products_insert" ON products;
CREATE POLICY "regiaire_products_insert"
  ON products FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_products_update" ON products;
CREATE POLICY "regiaire_products_update"
  ON products FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_products_delete" ON products;
CREATE POLICY "regiaire_products_delete"
  ON products FOR DELETE
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_deliveries_select" ON deliveries;
CREATE POLICY "regiaire_deliveries_select"
  ON deliveries FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_deliveries_insert" ON deliveries;
CREATE POLICY "regiaire_deliveries_insert"
  ON deliveries FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_deliveries_update" ON deliveries;
CREATE POLICY "regiaire_deliveries_update"
  ON deliveries FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_deliveries_delete" ON deliveries;
CREATE POLICY "regiaire_deliveries_delete"
  ON deliveries FOR DELETE
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_delivery_lines_select" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_select"
  ON delivery_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_org_member(d.organization_id)
    )
  );

DROP POLICY IF EXISTS "regiaire_delivery_lines_insert" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_insert"
  ON delivery_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_org_member(d.organization_id)
    )
  );

DROP POLICY IF EXISTS "regiaire_delivery_lines_update" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_update"
  ON delivery_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_org_member(d.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_org_member(d.organization_id)
    )
  );

DROP POLICY IF EXISTS "regiaire_delivery_lines_delete" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_delete"
  ON delivery_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_org_member(d.organization_id)
    )
  );

DROP POLICY IF EXISTS "regiaire_stock_batches_select" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_select"
  ON stock_batches FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_stock_batches_insert" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_insert"
  ON stock_batches FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_stock_batches_update" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_update"
  ON stock_batches FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_stock_batches_delete" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_delete"
  ON stock_batches FOR DELETE
  USING (is_org_member(organization_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'regiaire-bl',
  'regiaire-bl',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "regiaire_bl_select" ON storage.objects;
CREATE POLICY "regiaire_bl_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'regiaire-bl'
    AND (storage.foldername(name))[1] = 'bl'
    AND is_org_member(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "regiaire_bl_insert" ON storage.objects;
CREATE POLICY "regiaire_bl_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'regiaire-bl'
    AND (storage.foldername(name))[1] = 'bl'
    AND is_org_member(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "regiaire_bl_update" ON storage.objects;
CREATE POLICY "regiaire_bl_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'regiaire-bl'
    AND (storage.foldername(name))[1] = 'bl'
    AND is_org_member(((storage.foldername(name))[2])::uuid)
  )
  WITH CHECK (
    bucket_id = 'regiaire-bl'
    AND (storage.foldername(name))[1] = 'bl'
    AND is_org_member(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "regiaire_bl_delete" ON storage.objects;
CREATE POLICY "regiaire_bl_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'regiaire-bl'
    AND (storage.foldername(name))[1] = 'bl'
    AND is_org_member(((storage.foldername(name))[2])::uuid)
  );

-- ============================================
-- 8. RÉGIAIRE — RPC atomiques scan + finalisation (014)
-- ============================================

CREATE OR REPLACE FUNCTION regiaire_increment_scan(
  p_line_id uuid,
  p_allow_extra boolean,
  p_dlc date
)
RETURNS SETOF delivery_lines
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE delivery_lines
  SET scanned_qty = scanned_qty + 1,
      dlc = COALESCE(delivery_lines.dlc, p_dlc)
  WHERE id = p_line_id
    AND (p_allow_extra OR scanned_qty < expected_qty)
  RETURNING *;
$$;

COMMENT ON FUNCTION regiaire_increment_scan(uuid, boolean, date) IS
  'Incrémente scanned_qty d''une ligne BL si le plafond le permet (atomique, RLS invoker).';

CREATE OR REPLACE FUNCTION regiaire_decrement_scan(p_line_id uuid)
RETURNS SETOF delivery_lines
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE delivery_lines
  SET scanned_qty = scanned_qty - 1
  WHERE id = p_line_id
    AND scanned_qty > 0
  RETURNING *;
$$;

COMMENT ON FUNCTION regiaire_decrement_scan(uuid) IS
  'Décrémente scanned_qty d''une ligne BL (atomique, RLS invoker). 0 ligne = rien à annuler.';

CREATE OR REPLACE FUNCTION regiaire_finalize_delivery(p_delivery_id uuid)
RETURNS TABLE (outcome text, batches_created integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status delivery_status;
  v_org_id uuid;
  v_has_discrepancy boolean := false;
  v_batches integer := 0;
  v_line record;
BEGIN
  SELECT d.status, d.organization_id
  INTO v_status, v_org_id
  FROM deliveries d
  WHERE d.id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'delivery_not_found';
  END IF;

  IF v_status <> 'scanning' THEN
    outcome := 'already_finalized';
    batches_created := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM delivery_lines dl WHERE dl.delivery_id = p_delivery_id
  ) THEN
    RAISE EXCEPTION 'no_lines';
  END IF;

  FOR v_line IN
    SELECT dl.expected_qty, dl.scanned_qty, dl.product_id
    FROM delivery_lines dl
    WHERE dl.delivery_id = p_delivery_id
  LOOP
    IF v_line.scanned_qty > 0 AND v_line.product_id IS NULL THEN
      v_has_discrepancy := true;
    ELSIF v_line.expected_qty = 0 AND v_line.scanned_qty > 0 THEN
      v_has_discrepancy := true;
    ELSIF v_line.expected_qty > 0 AND v_line.scanned_qty IS DISTINCT FROM v_line.expected_qty THEN
      v_has_discrepancy := true;
    END IF;
  END LOOP;

  INSERT INTO stock_batches (organization_id, product_id, quantity, dlc, delivery_id)
  SELECT v_org_id, dl.product_id, dl.scanned_qty, dl.dlc, p_delivery_id
  FROM delivery_lines dl
  WHERE dl.delivery_id = p_delivery_id
    AND dl.scanned_qty > 0
    AND dl.product_id IS NOT NULL;

  GET DIAGNOSTICS v_batches = ROW_COUNT;

  IF v_batches = 0 THEN
    RAISE EXCEPTION 'no_scanned_stock';
  END IF;

  IF v_has_discrepancy THEN
    UPDATE deliveries
    SET status = 'discrepancy',
        completed_at = NOW()
    WHERE id = p_delivery_id;

    outcome := 'discrepancy';
  ELSE
    UPDATE deliveries
    SET status = 'completed',
        completed_at = NOW()
    WHERE id = p_delivery_id;

    outcome := 'completed';
  END IF;

  batches_created := v_batches;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION regiaire_finalize_delivery(uuid) IS
  'Finalise depuis scanning : stock_batches toujours, completed ou discrepancy (terminal).';

-- ============================================
-- 9. RÉGIAIRE — Équipe / passation de quart (018)
-- ============================================

DO $$
BEGIN
  CREATE TYPE shift_period AS ENUM ('matin', 'apres_midi', 'nuit');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS shift_task_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  shifts shift_period[] NOT NULL,
  position INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_task_defs_org ON shift_task_defs(organization_id);
CREATE INDEX IF NOT EXISTS idx_shift_task_defs_org_active ON shift_task_defs(organization_id, active);

CREATE TABLE IF NOT EXISTS shift_task_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shift shift_period NOT NULL,
  service_date DATE NOT NULL,
  task_def_id UUID NOT NULL REFERENCES shift_task_defs(id) ON DELETE CASCADE,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  UNIQUE (organization_id, shift, service_date, task_def_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_task_checks_lookup
  ON shift_task_checks(organization_id, shift, service_date);

CREATE TABLE IF NOT EXISTS shift_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shift shift_period NOT NULL,
  service_date DATE NOT NULL,
  closed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_tasks INT NOT NULL,
  checked_tasks INT NOT NULL,
  completion_pct NUMERIC(5, 2) NOT NULL,
  missing_labels TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  UNIQUE (organization_id, shift, service_date)
);

CREATE INDEX IF NOT EXISTS idx_shift_closures_org_date
  ON shift_closures(organization_id, service_date DESC);

ALTER TABLE shift_task_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_task_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regiaire_shift_task_defs_select" ON shift_task_defs;
CREATE POLICY "regiaire_shift_task_defs_select"
  ON shift_task_defs FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_defs_insert" ON shift_task_defs;
CREATE POLICY "regiaire_shift_task_defs_insert"
  ON shift_task_defs FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_defs_update" ON shift_task_defs;
CREATE POLICY "regiaire_shift_task_defs_update"
  ON shift_task_defs FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_defs_delete" ON shift_task_defs;
CREATE POLICY "regiaire_shift_task_defs_delete"
  ON shift_task_defs FOR DELETE
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_select" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_select"
  ON shift_task_checks FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_insert" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_insert"
  ON shift_task_checks FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_update" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_update"
  ON shift_task_checks FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_delete" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_delete"
  ON shift_task_checks FOR DELETE
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_select" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_select"
  ON shift_closures FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_insert" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_insert"
  ON shift_closures FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_update" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_update"
  ON shift_closures FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_delete" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_delete"
  ON shift_closures FOR DELETE
  USING (is_org_member(organization_id));

-- ============================================
-- 019 — Admin org : RLS is_org_admin + policies
-- ============================================

CREATE OR REPLACE FUNCTION is_org_admin(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION is_org_admin(UUID) IS
  'True si l''utilisateur courant est owner ou admin de l''organisation.';

DROP POLICY IF EXISTS "Org admins can view org members" ON organization_members;
CREATE POLICY "Org admins can view org members"
  ON organization_members FOR SELECT
  USING (is_org_admin(organization_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Org admins can update organization" ON organizations;
CREATE POLICY "Org admins can update organization"
  ON organizations FOR UPDATE
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));

-- ============================================
-- 020 — RégiAire Verdict IA (étape 1) : socle données + signaux
-- ============================================

CREATE TABLE IF NOT EXISTS regiaire_station_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  lat NUMERIC(9, 6) NOT NULL,
  lon NUMERIC(9, 6) NOT NULL,
  city TEXT,
  school_zone TEXT NOT NULL CHECK (school_zone IN ('A', 'B', 'C')),
  order_days INT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regiaire_station_settings_org
  ON regiaire_station_settings(organization_id);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category TEXT;

CREATE TABLE IF NOT EXISTS sales_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  quantity INT NOT NULL CHECK (quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_history_org_date
  ON sales_history(organization_id, sale_date);

CREATE INDEX IF NOT EXISTS idx_sales_history_org_product_date
  ON sales_history(organization_id, product_id, sale_date);

CREATE TABLE IF NOT EXISTS traffic_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_date DATE NOT NULL,
  footfall_index NUMERIC(8, 2) NOT NULL CHECK (footfall_index >= 0),
  UNIQUE (organization_id, signal_date)
);

CREATE INDEX IF NOT EXISTS idx_traffic_signals_org_date
  ON traffic_signals(organization_id, signal_date DESC);

CREATE TABLE IF NOT EXISTS verdict_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verdict_runs_org_date
  ON verdict_runs(organization_id, run_date DESC);

ALTER TABLE regiaire_station_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE verdict_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regiaire_station_settings_select" ON regiaire_station_settings;
CREATE POLICY "regiaire_station_settings_select"
  ON regiaire_station_settings FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_station_settings_insert" ON regiaire_station_settings;
CREATE POLICY "regiaire_station_settings_insert"
  ON regiaire_station_settings FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_station_settings_update" ON regiaire_station_settings;
CREATE POLICY "regiaire_station_settings_update"
  ON regiaire_station_settings FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_station_settings_delete" ON regiaire_station_settings;
CREATE POLICY "regiaire_station_settings_delete"
  ON regiaire_station_settings FOR DELETE
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_sales_history_select" ON sales_history;
CREATE POLICY "regiaire_sales_history_select"
  ON sales_history FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_sales_history_insert" ON sales_history;
CREATE POLICY "regiaire_sales_history_insert"
  ON sales_history FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_sales_history_update" ON sales_history;
CREATE POLICY "regiaire_sales_history_update"
  ON sales_history FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_sales_history_delete" ON sales_history;
CREATE POLICY "regiaire_sales_history_delete"
  ON sales_history FOR DELETE
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_traffic_signals_select" ON traffic_signals;
CREATE POLICY "regiaire_traffic_signals_select"
  ON traffic_signals FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_traffic_signals_insert" ON traffic_signals;
CREATE POLICY "regiaire_traffic_signals_insert"
  ON traffic_signals FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_traffic_signals_update" ON traffic_signals;
CREATE POLICY "regiaire_traffic_signals_update"
  ON traffic_signals FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_traffic_signals_delete" ON traffic_signals;
CREATE POLICY "regiaire_traffic_signals_delete"
  ON traffic_signals FOR DELETE
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_verdict_runs_select" ON verdict_runs;
CREATE POLICY "regiaire_verdict_runs_select"
  ON verdict_runs FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_verdict_runs_insert" ON verdict_runs;
CREATE POLICY "regiaire_verdict_runs_insert"
  ON verdict_runs FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_verdict_runs_update" ON verdict_runs;
CREATE POLICY "regiaire_verdict_runs_update"
  ON verdict_runs FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_verdict_runs_delete" ON verdict_runs;
CREATE POLICY "regiaire_verdict_runs_delete"
  ON verdict_runs FOR DELETE
  USING (is_org_member(organization_id));

CREATE UNIQUE INDEX IF NOT EXISTS idx_verdict_runs_org_run_date_unique
  ON verdict_runs(organization_id, run_date);

-- ============================================
-- FIN DU SCRIPT D'INITIALISATION
-- ============================================


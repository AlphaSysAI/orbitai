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
CREATE OR REPLACE VIEW v_user_action_success_count AS
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
COMMENT ON VIEW v_user_action_success_count IS 'Nombre de succès (lignes agent_actions_index) par user_id et action_type.';
COMMENT ON FUNCTION get_success_count_by_action(UUID) IS 'Retourne le nombre de succès par action_type pour un utilisateur (déclenchement paliers Auto-Pilot).';

-- ============================================
-- FIN DU SCRIPT D'INITIALISATION
-- ============================================


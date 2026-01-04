-- Configuration de la base de données pour Simulation Décisionnelle
-- Exécutez cette requête dans votre console Supabase SQL Editor

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

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_decision_simulations_user_id ON decision_simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_simulations_updated_at ON decision_simulations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_simulations_status ON decision_simulations(status);

-- Politique RLS (Row Level Security)
ALTER TABLE decision_simulations ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres simulations
CREATE POLICY "Users can view their own simulations"
  ON decision_simulations FOR SELECT
  USING (auth.uid() = user_id);

-- Les utilisateurs peuvent créer leurs propres simulations
CREATE POLICY "Users can create their own simulations"
  ON decision_simulations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent modifier leurs propres simulations
CREATE POLICY "Users can update their own simulations"
  ON decision_simulations FOR UPDATE
  USING (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer leurs propres simulations
CREATE POLICY "Users can delete their own simulations"
  ON decision_simulations FOR DELETE
  USING (auth.uid() = user_id);


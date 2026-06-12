-- ============================================
-- Auto-Pilot : politiques d'automatisation (deux paliers de confiance)
-- ============================================
-- status : PENDING (offre palier 1), DECLINED_50 (refus palier 1 ou 2), DECLINED_100 (révoqué), ENABLED (auto-approuvé).
-- success_count : dérivé de agent_actions_index (nombre de succès par user_id + action).
-- ============================================

-- Table: automation_policies (une ligne par user_id + action_type)
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
-- On utilise un policy avec WITH CHECK (true) pour permettre l'insert par le backend (service_role contourne RLS).

-- Vue : success_count par (user_id, action_type) à partir de agent_actions_index
CREATE OR REPLACE VIEW v_user_action_success_count AS
SELECT
  user_id,
  action AS action_type,
  COUNT(*)::integer AS success_count
FROM agent_actions_index
GROUP BY user_id, action;

-- RLS sur la vue : la vue lit agent_actions_index qui a RLS, donc les lignes sont filtrées par auth.uid().
-- Pour une vue, on ne définit pas de RLS directement ; l'accès se fait via une requête qui filtre user_id.
-- L'API utilisera le service role ou filtrera par user_id côté app.

COMMENT ON TABLE automation_policies IS 'Auto-Pilot: paliers 50 (PENDING -> ENABLED/DECLINED_50) et palier 2 (DECLINED_50 -> ENABLED/DECLINED_50). DECLINED_100 = révoqué.';
COMMENT ON VIEW v_user_action_success_count IS 'Nombre de succès (lignes agent_actions_index) par user_id et action_type.';

-- Fonction : retourne success_count par action_type pour un user_id (pour déclencher les paliers).
CREATE OR REPLACE FUNCTION get_success_count_by_action(p_user_id UUID)
RETURNS TABLE(action_type TEXT, success_count INTEGER) AS $$
  SELECT action::TEXT AS action_type, COUNT(*)::INTEGER AS success_count
  FROM agent_actions_index
  WHERE user_id = p_user_id
  GROUP BY action;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_success_count_by_action(UUID) IS 'Retourne le nombre de succès par action_type pour un utilisateur (déclenchement paliers Auto-Pilot).';

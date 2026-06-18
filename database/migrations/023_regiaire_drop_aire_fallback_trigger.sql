-- ============================================
-- 023 — RégiAire multi-aires étape 2 : suppression fallback aire_id
-- Inserts deliveries sans aire_id doivent échouer (NOT NULL).
-- ============================================

BEGIN;

DROP TRIGGER IF EXISTS deliveries_set_default_aire_id ON deliveries;
DROP FUNCTION IF EXISTS trg_regiaire_set_default_aire_id();

COMMENT ON FUNCTION regiaire_default_aire_id(UUID) IS
  'Aire par défaut d''une org (utilitaire listing / redirect UI). Plus de fallback insert.';

COMMIT;

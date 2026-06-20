-- ============================================
-- 024 — RégiAire : adresse complète sur les aires (géoloc météo / Bison Futé)
-- ============================================

BEGIN;

ALTER TABLE aires ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN aires.address IS
  'Adresse postale complète (saisie assistée BAN) pour géolocalisation météo et trafic.';

COMMIT;

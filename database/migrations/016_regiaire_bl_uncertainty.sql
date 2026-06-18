-- ============================================
-- RégiAire Réception — EAN en instance + revue incertaine
-- ============================================

BEGIN;

ALTER TABLE delivery_lines
  ALTER COLUMN ean DROP NOT NULL;

ALTER TABLE delivery_lines
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN delivery_lines.ean IS
  'EAN/GTIN ; NULL = ligne en instance (EAN à résoudre au scan).';
COMMENT ON COLUMN delivery_lines.needs_review IS
  'true si nom ou qté attendue nécessitent correction avant passage en scan.';

COMMIT;

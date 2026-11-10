-- ============================================
-- 026 — RégiAire Verdict : zone Bison Futé par aire + prévisions nationales
-- ============================================

BEGIN;

ALTER TABLE aires
  ADD COLUMN IF NOT EXISTS bison_fute_zone SMALLINT
  CHECK (bison_fute_zone IS NULL OR (bison_fute_zone >= 1 AND bison_fute_zone <= 6));

COMMENT ON COLUMN aires.bison_fute_zone IS
  'Zone Bison Futé (1=IDF … 6=Arc méditerranéen) pour les prévisions trafic Verdict.';

CREATE TABLE IF NOT EXISTS bison_fute_forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date DATE NOT NULL,
  zone SMALLINT NOT NULL CHECK (zone >= 1 AND zone <= 6),
  direction TEXT NOT NULL CHECK (direction IN ('aller', 'retour')),
  level TEXT NOT NULL CHECK (level IN ('vert', 'orange', 'rouge', 'noir')),
  UNIQUE (forecast_date, zone, direction)
);

CREATE INDEX IF NOT EXISTS idx_bison_fute_forecast_date_zone
  ON bison_fute_forecast (forecast_date, zone);

COMMENT ON TABLE bison_fute_forecast IS
  'Prévisions nationales Bison Futé (jours colorés). Référence partagée, refresh cron service_role.';

ALTER TABLE bison_fute_forecast ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bison_fute_forecast_select_authenticated" ON bison_fute_forecast;
CREATE POLICY "bison_fute_forecast_select_authenticated"
  ON bison_fute_forecast FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

COMMIT;

-- ============================================
-- 020 — RégiAire Verdict IA (étape 1) : socle données + signaux
-- RLS is_org_member (USING + WITH CHECK).
-- ============================================

BEGIN;

-- Paramètres station (météo, zone scolaire, jours de commande)
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

COMMENT ON TABLE regiaire_station_settings IS
  'Paramètres station RégiAire (Verdict IA) par organisation.';

-- Rayon produit (tendances agrégées)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category TEXT;

COMMENT ON COLUMN products.category IS
  'Rayon / catégorie merchandising (tendances Verdict).';

-- Historique ventes (seed démo → remplacer par flux réel)
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

COMMENT ON TABLE sales_history IS
  'Ventes journalières par produit (Verdict IA). Seed démo — à remplacer par POS réel.';

-- Signaux trafic simulés (seed démo → remplacer par comptage réel)
CREATE TABLE IF NOT EXISTS traffic_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_date DATE NOT NULL,
  footfall_index NUMERIC(8, 2) NOT NULL CHECK (footfall_index >= 0),
  UNIQUE (organization_id, signal_date)
);

CREATE INDEX IF NOT EXISTS idx_traffic_signals_org_date
  ON traffic_signals(organization_id, signal_date DESC);

COMMENT ON TABLE traffic_signals IS
  'Indice de fréquentation journalier (Verdict IA). Seed démo — à remplacer par capteur réel.';

-- Exécutions Verdict (signals + recommendation remplis à l''étape 2)
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

COMMENT ON TABLE verdict_runs IS
  'Runs Verdict IA : signaux agrégés + recommandation (étape génération IA).';

-- RLS
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

COMMIT;

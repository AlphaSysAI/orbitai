-- ============================================
-- 034 — Cache des résumés de secteur (dashboards direction / région)
--
-- Les dashboards d'agrégation (getDirectionOverview / getRegionOverview)
-- recalculaient ~5 requêtes PAR aire, sans cache : une enseigne de 300 aires
-- = ~1500 requêtes par chargement. Ce cache stocke le résumé agrégé par
-- secteur et par jour, avec fenêtre de fraîcheur courte côté applicatif.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS secteur_overview_cache (
  secteur_id UUID NOT NULL REFERENCES secteurs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  aire_count INT NOT NULL DEFAULT 0,
  total_savings_eur NUMERIC NOT NULL DEFAULT 0,
  expiring_count INT NOT NULL DEFAULT 0,
  in_progress_count INT NOT NULL DEFAULT 0,
  reception_hours_saved NUMERIC NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (secteur_id, run_date)
);

CREATE INDEX IF NOT EXISTS idx_secteur_overview_cache_org
  ON secteur_overview_cache(organization_id, run_date DESC);

COMMENT ON TABLE secteur_overview_cache IS
  'Cache journalier des résumés agrégés de secteur (KPIs dashboards direction/région).';

-- ─── RLS : lecture + écriture intra-org ──────────────────────────────────────
-- Le cache est rempli par la session du chef/régional/direction qui consulte le
-- dashboard. Lecture et upsert réservés aux membres de l'org propriétaire.
ALTER TABLE secteur_overview_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "secteur_overview_cache_select" ON secteur_overview_cache;
CREATE POLICY "secteur_overview_cache_select" ON secteur_overview_cache FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "secteur_overview_cache_insert" ON secteur_overview_cache;
CREATE POLICY "secteur_overview_cache_insert" ON secteur_overview_cache FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "secteur_overview_cache_update" ON secteur_overview_cache;
CREATE POLICY "secteur_overview_cache_update" ON secteur_overview_cache FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

COMMIT;

-- ============================================
-- 036 — Modules transverses par aire (Orbit Aire)
--
-- Les add-ons IA transverses (copilote, base de connaissances, etc.) ne sont
-- plus attribués à l'entité (organisation) entière mais AIRE PAR AIRE.
-- Présence d'une ligne = module activé pour cette aire.
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS aire_modules (
  aire_id UUID NOT NULL REFERENCES aires(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (aire_id, module_name)
);

CREATE INDEX IF NOT EXISTS idx_aire_modules_org ON aire_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_aire_modules_aire ON aire_modules(aire_id);

COMMENT ON TABLE aire_modules IS
  'Add-ons IA transverses activés par aire (Orbit Aire). Présence = activé.';

-- ─── RLS : lecture intra-org, écriture réservée aux admins org ───────────────
ALTER TABLE aire_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aire_modules_select" ON aire_modules;
CREATE POLICY "aire_modules_select" ON aire_modules FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "aire_modules_insert" ON aire_modules;
CREATE POLICY "aire_modules_insert" ON aire_modules FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

DROP POLICY IF EXISTS "aire_modules_delete" ON aire_modules;
CREATE POLICY "aire_modules_delete" ON aire_modules FOR DELETE
  USING (is_org_admin(organization_id));

COMMIT;

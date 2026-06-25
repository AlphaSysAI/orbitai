-- ============================================
-- 030 — Attribution explicite gérant → aires
-- Un gérant (hiérarchie enseigne) exploite N aires précises de son secteur.
-- À ne pas confondre avec les rôles d'équipe intra-aire (directeur/membre).
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS gerant_aires (
  gerant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aire_id UUID NOT NULL REFERENCES aires(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (gerant_user_id, aire_id)
);

CREATE INDEX IF NOT EXISTS idx_gerant_aires_gerant ON gerant_aires(gerant_user_id);
CREATE INDEX IF NOT EXISTS idx_gerant_aires_aire ON gerant_aires(aire_id);
CREATE INDEX IF NOT EXISTS idx_gerant_aires_org ON gerant_aires(organization_id);

COMMENT ON TABLE gerant_aires IS
  'Aires exploitées par un gérant (hiérarchie enseigne). Attribution explicite.';

-- Direction France hérite des droits admin org (remplace l'ancien rôle "admin"
-- comme compte au sommet d'une enseigne).
CREATE OR REPLACE FUNCTION is_org_admin(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'direction_france')
  );
$$;

-- RLS : lecture intra-org, écriture admin (provisioning en service_role)
ALTER TABLE gerant_aires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gerant_aires_select" ON gerant_aires;
CREATE POLICY "gerant_aires_select" ON gerant_aires FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "gerant_aires_admin_write" ON gerant_aires;
CREATE POLICY "gerant_aires_admin_write" ON gerant_aires FOR ALL
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

COMMIT;

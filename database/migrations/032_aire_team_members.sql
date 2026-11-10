-- ============================================
-- 032 — Employés par aire + rattachement gérant
-- Le gérant crée des comptes employé limités à ses aires.
-- ============================================

BEGIN;

-- ─── Rôle employe ───────────────────────────────────────────────────────────

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN (
    'owner',
    'admin',
    'member',
    'direction_france',
    'directeur_region',
    'chef_secteur',
    'gerant',
    'employe'
  ));

-- ─── Table aire_team_members ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aire_team_members (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aire_id UUID NOT NULL REFERENCES aires(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, aire_id)
);

CREATE INDEX IF NOT EXISTS idx_aire_team_members_aire ON aire_team_members(aire_id);
CREATE INDEX IF NOT EXISTS idx_aire_team_members_user ON aire_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_aire_team_members_org ON aire_team_members(organization_id);

COMMENT ON TABLE aire_team_members IS
  'Employés opérationnels rattachés à une aire (quarts, passation, réception).';

-- ─── Helpers périmètre aire ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_gerant_of_aire(p_aire_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM gerant_aires ga
    INNER JOIN organization_members om
      ON om.user_id = ga.gerant_user_id
     AND om.organization_id = ga.organization_id
     AND om.role = 'gerant'
    WHERE ga.gerant_user_id = auth.uid()
      AND ga.aire_id = p_aire_id
  );
$$;

COMMENT ON FUNCTION is_gerant_of_aire(UUID) IS
  'True si l''utilisateur courant est gérant de l''aire.';

CREATE OR REPLACE FUNCTION is_aire_member(p_aire_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM aires a
    INNER JOIN organization_members om
      ON om.organization_id = a.organization_id
     AND om.user_id = auth.uid()
    WHERE a.id = p_aire_id
      AND (
        om.role IN (
          'owner',
          'admin',
          'direction_france',
          'member'
        )
        OR (
          om.role = 'gerant'
          AND EXISTS (
            SELECT 1 FROM gerant_aires ga
            WHERE ga.gerant_user_id = auth.uid()
              AND ga.aire_id = p_aire_id
          )
        )
        OR (
          om.role = 'employe'
          AND EXISTS (
            SELECT 1 FROM aire_team_members atm
            WHERE atm.user_id = auth.uid()
              AND atm.aire_id = p_aire_id
          )
        )
        OR (
          om.role = 'chef_secteur'
          AND a.secteur_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM secteurs s
            WHERE s.id = a.secteur_id
              AND s.chef_user_id = auth.uid()
          )
        )
        OR (
          om.role = 'directeur_region'
          AND a.secteur_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM secteurs s
            INNER JOIN org_hierarchy_links ohl
              ON ohl.subordinate_user_id = s.chef_user_id
            WHERE s.id = a.secteur_id
              AND ohl.manager_user_id = auth.uid()
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION is_aire_member(UUID) IS
  'True si l''utilisateur courant a accès opérationnel à l''aire (périmètre par rôle).';

-- ─── RLS aire_team_members ──────────────────────────────────────────────────

ALTER TABLE aire_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aire_team_members_select" ON aire_team_members;
CREATE POLICY "aire_team_members_select"
  ON aire_team_members FOR SELECT
  USING (
    is_org_member(organization_id)
    AND (
      is_org_admin(organization_id)
      OR is_gerant_of_aire(aire_id)
      OR user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "aire_team_members_insert" ON aire_team_members;
CREATE POLICY "aire_team_members_insert"
  ON aire_team_members FOR INSERT
  WITH CHECK (
    is_org_member(organization_id)
    AND (is_org_admin(organization_id) OR is_gerant_of_aire(aire_id))
  );

DROP POLICY IF EXISTS "aire_team_members_delete" ON aire_team_members;
CREATE POLICY "aire_team_members_delete"
  ON aire_team_members FOR DELETE
  USING (
    is_org_member(organization_id)
    AND (is_org_admin(organization_id) OR is_gerant_of_aire(aire_id))
  );

COMMIT;

-- ============================================
-- 009 — Multi-tenant : organizations + modules
-- Idempotent. Exécuter dans Supabase SQL Editor.
-- ============================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Tenant / organisation cliente OrbitAI.';

-- Liaison utilisateur ↔ organisation (requis pour RLS multi-tenant)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);

COMMENT ON TABLE organization_members IS 'Appartenance utilisateur à une organisation.';

CREATE TABLE IF NOT EXISTS organization_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, module_name)
);

CREATE INDEX IF NOT EXISTS idx_organization_modules_org_id ON organization_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_modules_name ON organization_modules(module_name);

COMMENT ON TABLE organization_modules IS
  'Modules activés par organisation (ex: knowledge_base, regiaire_core).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
CREATE POLICY "Members can view their organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own memberships" ON organization_members;
CREATE POLICY "Users can view own memberships"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can view org modules" ON organization_modules;
CREATE POLICY "Members can view org modules"
  ON organization_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_modules.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE réservés au service_role (provisioning admin) pour l'instant.

-- ---------------------------------------------------------------------------
-- RPC : vérifier l'accès à un module
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION org_has_module(
  p_organization_id UUID,
  p_module_name TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_modules om
    INNER JOIN organization_members mem
      ON mem.organization_id = om.organization_id
    WHERE om.organization_id = p_organization_id
      AND om.module_name = p_module_name
      AND om.is_enabled = true
      AND mem.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION org_has_module(UUID, TEXT) IS
  'Retourne true si l''utilisateur courant est membre de l''org et le module est activé.';

-- Liste des modules activés pour l'utilisateur courant (première org trouvée)
CREATE OR REPLACE FUNCTION get_my_enabled_modules()
RETURNS TABLE(
  organization_id UUID,
  module_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.organization_id, om.module_name
  FROM organization_modules om
  INNER JOIN organization_members mem
    ON mem.organization_id = om.organization_id
  WHERE mem.user_id = auth.uid()
    AND om.is_enabled = true
  ORDER BY om.module_name;
$$;

COMMENT ON FUNCTION get_my_enabled_modules() IS
  'Modules activés pour l''utilisateur authentifié (toutes ses organisations).';

COMMIT;

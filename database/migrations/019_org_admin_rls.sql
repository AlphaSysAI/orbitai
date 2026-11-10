-- ============================================
-- 019 — Admin org : RLS is_org_admin + policies
-- ============================================

BEGIN;

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
      AND role IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION is_org_admin(UUID) IS
  'True si l''utilisateur courant est owner ou admin de l''organisation.';

DROP POLICY IF EXISTS "Org admins can view org members" ON organization_members;
CREATE POLICY "Org admins can view org members"
  ON organization_members FOR SELECT
  USING (is_org_admin(organization_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Org admins can update organization" ON organizations;
CREATE POLICY "Org admins can update organization"
  ON organizations FOR UPDATE
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));

COMMIT;

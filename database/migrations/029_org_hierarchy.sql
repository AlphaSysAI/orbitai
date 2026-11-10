-- ============================================
-- 029 — Hiérarchie d'enseigne RégiAire
-- Direction France → Directeur de région → Chef de secteur → Gérant
-- Secteur = groupe d'aires. Remplace le modèle plat sector_manager_*.
-- ============================================

BEGIN;

-- ─── Secteurs ────────────────────────────────────────────────────────────
-- Un secteur regroupe plusieurs aires, possédé par un chef de secteur.
CREATE TABLE IF NOT EXISTS secteurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  chef_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secteurs_org ON secteurs(organization_id);
CREATE INDEX IF NOT EXISTS idx_secteurs_chef ON secteurs(chef_user_id);

COMMENT ON TABLE secteurs IS
  'Secteur = groupe d''aires possédé par un chef de secteur (hiérarchie enseigne).';

-- ─── Rattachement aire → secteur ─────────────────────────────────────────
ALTER TABLE aires ADD COLUMN IF NOT EXISTS secteur_id UUID
  REFERENCES secteurs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_aires_secteur ON aires(secteur_id);

-- ─── Liens hiérarchiques explicites ──────────────────────────────────────
-- Couvre direction_france → directeur_region ET directeur_region → chef_secteur.
CREATE TABLE IF NOT EXISTS org_hierarchy_links (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  manager_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subordinate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (manager_user_id, subordinate_user_id)
);

CREATE INDEX IF NOT EXISTS idx_hierarchy_manager ON org_hierarchy_links(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_subordinate ON org_hierarchy_links(subordinate_user_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_org ON org_hierarchy_links(organization_id);

COMMENT ON TABLE org_hierarchy_links IS
  'Attribution explicite superviseur → supervisé (Direction→Région, Région→Secteur).';

-- ─── Profils membres consolidés ──────────────────────────────────────────
-- Source unique prénom/nom/email/téléphone pour tous les rôles hiérarchie.
CREATE TABLE IF NOT EXISTS org_member_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_profiles_org ON org_member_profiles(organization_id);

COMMENT ON TABLE org_member_profiles IS
  'Profil affichage (prénom/nom/email/tél) pour les comptes de la hiérarchie.';

-- ─── Cache Verdict IA secteur ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS secteur_verdict_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  secteur_id UUID NOT NULL REFERENCES secteurs(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_secteur_verdict_runs
  ON secteur_verdict_runs(secteur_id, run_date);
CREATE INDEX IF NOT EXISTS idx_secteur_verdict_runs_org
  ON secteur_verdict_runs(organization_id, run_date DESC);

COMMENT ON TABLE secteur_verdict_runs IS
  'Cache Verdict IA global secteur (plan d''action multi-aires).';

-- ─── Migration des données legacy sector_manager_* ───────────────────────
DO $$
DECLARE
  rec RECORD;
  new_secteur_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sector_manager_profiles') THEN
    -- 1. Profils → org_member_profiles
    INSERT INTO org_member_profiles (user_id, organization_id, first_name, last_name, email, phone)
    SELECT user_id, organization_id, first_name, last_name, email, phone
    FROM sector_manager_profiles
    ON CONFLICT (user_id) DO NOTHING;

    -- 2. Un secteur par ancien chef + rattachement de ses aires
    FOR rec IN SELECT * FROM sector_manager_profiles LOOP
      INSERT INTO secteurs (organization_id, name, chef_user_id)
      VALUES (rec.organization_id, 'Secteur ' || rec.last_name, rec.user_id)
      RETURNING id INTO new_secteur_id;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sector_manager_aires') THEN
        UPDATE aires
        SET secteur_id = new_secteur_id
        WHERE id IN (
          SELECT aire_id FROM sector_manager_aires
          WHERE sector_manager_id = rec.user_id
        );
      END IF;
    END LOOP;

    -- 3. Renommer le rôle legacy sector_manager → chef_secteur
    UPDATE organization_members SET role = 'chef_secteur' WHERE role = 'sector_manager';
  END IF;
END $$;

-- ─── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE secteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_hierarchy_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE secteur_verdict_runs ENABLE ROW LEVEL SECURITY;

-- secteurs : lecture intra-org, écriture admin (le provisioning passe en service_role)
DROP POLICY IF EXISTS "secteurs_select" ON secteurs;
CREATE POLICY "secteurs_select" ON secteurs FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "secteurs_admin_write" ON secteurs;
CREATE POLICY "secteurs_admin_write" ON secteurs FOR ALL
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- org_hierarchy_links : lecture intra-org
DROP POLICY IF EXISTS "hierarchy_select" ON org_hierarchy_links;
CREATE POLICY "hierarchy_select" ON org_hierarchy_links FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "hierarchy_admin_write" ON org_hierarchy_links;
CREATE POLICY "hierarchy_admin_write" ON org_hierarchy_links FOR ALL
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- org_member_profiles : lecture intra-org
DROP POLICY IF EXISTS "member_profiles_select" ON org_member_profiles;
CREATE POLICY "member_profiles_select" ON org_member_profiles FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "member_profiles_admin_write" ON org_member_profiles;
CREATE POLICY "member_profiles_admin_write" ON org_member_profiles FOR ALL
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- secteur_verdict_runs : lecture + insertion intra-org (généré côté chef/dashboard)
DROP POLICY IF EXISTS "secteur_verdict_select" ON secteur_verdict_runs;
CREATE POLICY "secteur_verdict_select" ON secteur_verdict_runs FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "secteur_verdict_insert" ON secteur_verdict_runs;
CREATE POLICY "secteur_verdict_insert" ON secteur_verdict_runs FOR INSERT
  WITH CHECK (is_org_member(organization_id));

-- ─── Suppression des tables legacy ───────────────────────────────────────
DROP TABLE IF EXISTS sector_manager_aires;
DROP TABLE IF EXISTS sector_manager_profiles;

COMMIT;

-- ============================================
-- 031 — Étend la contrainte de rôle organization_members
-- pour les rôles de la hiérarchie d'enseigne (cf. 029).
-- ============================================

BEGIN;

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

-- Sécurité : aucune valeur legacy ne doit rester hors de la nouvelle liste.
UPDATE organization_members SET role = 'chef_secteur' WHERE role = 'sector_manager';

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN (
    'owner',
    'admin',
    'member',
    'direction_france',
    'directeur_region',
    'chef_secteur',
    'gerant'
  ));

COMMIT;

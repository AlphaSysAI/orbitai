-- ============================================
-- 010 — Profil client sur organizations (admin)
-- Idempotent.
-- ============================================

BEGIN;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS manager_first_name TEXT,
  ADD COLUMN IF NOT EXISTS manager_last_name TEXT,
  ADD COLUMN IF NOT EXISTS manager_email TEXT,
  ADD COLUMN IF NOT EXISTS business_sector TEXT;

CREATE INDEX IF NOT EXISTS idx_organizations_manager_email ON organizations(manager_email);

COMMENT ON COLUMN organizations.manager_first_name IS 'Prénom du responsable client.';
COMMENT ON COLUMN organizations.manager_last_name IS 'Nom du responsable client.';
COMMENT ON COLUMN organizations.manager_email IS 'Email de connexion du responsable (auth.users).';
COMMENT ON COLUMN organizations.business_sector IS 'Métier / secteur d''activité du client.';

COMMIT;

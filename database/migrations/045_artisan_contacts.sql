-- ============================================
-- 045 — Orbit Artisan : Contacts (carnet clients / CRM interne)
--
-- Carnet de clients propre à l'organisation artisan : fiche contact
-- (identité, coordonnées, société, adresse, notes) reliée aux devis et
-- factures. Modèle natif OrbitAll — AUCUN portage de la machinerie source
-- (platform_invitations / conversations / customer_profiles / auth client).
--
-- Scoping : organization_id + RLS is_org_member (cf. 035_artisan_core).
-- Rattachement : colonne contact_id nullable sur artisan_quotes /
-- artisan_invoices (ON DELETE SET NULL — supprimer un contact ne détruit
-- jamais l'historique documentaire, qui garde son nom/email dénormalisé).
-- ============================================

BEGIN;

-- ─── Carnet de contacts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artisan_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT artisan_contacts_full_name_not_blank CHECK (btrim(full_name) <> '')
);
CREATE INDEX IF NOT EXISTS artisan_contacts_org_idx ON artisan_contacts(organization_id);
CREATE INDEX IF NOT EXISTS artisan_contacts_email_idx ON artisan_contacts(organization_id, email);

-- ─── Rattachement devis / factures → contact ─────────────────────────────────
ALTER TABLE artisan_quotes
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES artisan_contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS artisan_quotes_contact_idx ON artisan_quotes(contact_id);

ALTER TABLE artisan_invoices
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES artisan_contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS artisan_invoices_contact_idx ON artisan_invoices(contact_id);

-- ─── updated_at ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_artisan_contacts_updated_at ON artisan_contacts;
CREATE TRIGGER set_artisan_contacts_updated_at BEFORE UPDATE ON artisan_contacts
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─── RLS : membres de l'organisation ─────────────────────────────────────────
ALTER TABLE artisan_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS artisan_contacts_member ON artisan_contacts;
CREATE POLICY artisan_contacts_member ON artisan_contacts FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

COMMIT;

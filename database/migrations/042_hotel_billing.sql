-- ============================================
-- 042 — Orbit Hôtel : taxe de séjour + factures
--
-- Phase 2, lot 7 (final PMS cœur). Porté (simplifié) de 036_pms_city_tax et
-- 038_pms_invoices. Préfixe hotel_, organization_id, RLS is_org_member.
-- Facturation = document comptable généré depuis un séjour (pas d'encaissement).
-- Taxe de séjour : mode « forfait par personne et par nuit » (cas courant FR).
-- ============================================

BEGIN;

-- ─── Config taxe de séjour (1 par organisation) ─────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_city_tax_config (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  amount_cents_per_person_night INT NOT NULL DEFAULT 0 CHECK (amount_cents_per_person_night >= 0),
  exempt_children BOOLEAN NOT NULL DEFAULT TRUE,
  max_nights INT CHECK (max_nights IS NULL OR max_nights > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Factures ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES hotel_reservations(id) ON DELETE SET NULL,
  invoice_number TEXT,
  customer_name TEXT,
  customer_email TEXT,
  subtotal_cents INT NOT NULL DEFAULT 0,
  city_tax_cents INT NOT NULL DEFAULT 0,
  total_cents INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hotel_invoices_reservation_unique UNIQUE (reservation_id)
);
CREATE INDEX IF NOT EXISTS idx_hotel_invoices_org ON hotel_invoices(organization_id);

CREATE TABLE IF NOT EXISTS hotel_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES hotel_invoices(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount_cents INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hotel_invoice_lines_invoice ON hotel_invoice_lines(invoice_id);

-- ─── updated_at ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS set_hotel_city_tax_updated_at ON hotel_city_tax_config;
CREATE TRIGGER set_hotel_city_tax_updated_at BEFORE UPDATE ON hotel_city_tax_config
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS set_hotel_invoices_updated_at ON hotel_invoices;
CREATE TRIGGER set_hotel_invoices_updated_at BEFORE UPDATE ON hotel_invoices
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE hotel_city_tax_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_city_tax_member ON hotel_city_tax_config;
CREATE POLICY hotel_city_tax_member ON hotel_city_tax_config FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS hotel_invoices_member ON hotel_invoices;
CREATE POLICY hotel_invoices_member ON hotel_invoices FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS hotel_invoice_lines_member ON hotel_invoice_lines;
CREATE POLICY hotel_invoice_lines_member ON hotel_invoice_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM hotel_invoices i
                 WHERE i.id = hotel_invoice_lines.invoice_id AND is_org_member(i.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM hotel_invoices i
                 WHERE i.id = hotel_invoice_lines.invoice_id AND is_org_member(i.organization_id)));

COMMIT;

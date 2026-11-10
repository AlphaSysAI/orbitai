-- ============================================
-- 035 — Orbit Artisan : cœur métier (devis / factures)
--
-- Portage du vertical Orbit Artisan (ex-projet standalone) sous OrbitAll.
-- Périmètre Phase 1 (côté artisan uniquement) :
--   - profil artisan (rattaché à l'organisation, 1:1)
--   - prestations (services)
--   - devis (quotes) + lignes prestations + lignes matériaux
--   - factures (invoices) + lignes
-- Hors périmètre (plus tard) : portail client, RPC d'acceptation client,
--   site vitrine public, prise de RDV, Stripe Connect.
--
-- Modèle : « 1 artisan = 1 organisation OrbitAll ». Le scoping se fait par
-- organization_id (remplace l'ancien artisan_id → profiles). RLS = is_org_member.
-- Montants en centimes (integer).
-- ============================================

BEGIN;

-- ─── Types ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'artisan_quote_status') THEN
    CREATE TYPE artisan_quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');
  END IF;
END $$;

-- ─── Profil artisan (paramètres métier de l'organisation, 1:1) ───────────────
CREATE TABLE IF NOT EXISTS artisan_profiles (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  logo_url TEXT,
  accent_color TEXT,
  labor_rate_per_hour INTEGER, -- centimes / heure
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT artisan_profiles_slug_format
    CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT artisan_profiles_accent_color_format
    CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT artisan_profiles_labor_rate_nonneg
    CHECK (labor_rate_per_hour IS NULL OR labor_rate_per_hour >= 0)
);

-- ─── Prestations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artisan_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration INTEGER NOT NULL, -- minutes
  price INTEGER, -- centimes (NULL = sur devis)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT artisan_services_duration_positive CHECK (duration > 0),
  CONSTRAINT artisan_services_price_nonneg CHECK (price IS NULL OR price >= 0)
);
CREATE INDEX IF NOT EXISTS artisan_services_org_idx ON artisan_services(organization_id);

-- ─── Devis ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artisan_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  status artisan_quote_status NOT NULL DEFAULT 'draft',
  labor_rate_per_hour INTEGER,
  labor_duration_minutes INTEGER NOT NULL DEFAULT 0,
  labor_total INTEGER NOT NULL DEFAULT 0,
  materials_total INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  signed_at TIMESTAMPTZ,
  signed_by_name TEXT,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS artisan_quotes_org_idx ON artisan_quotes(organization_id);
CREATE INDEX IF NOT EXISTS artisan_quotes_customer_email_idx ON artisan_quotes(customer_email);

CREATE TABLE IF NOT EXISTS artisan_quote_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES artisan_quotes(id) ON DELETE CASCADE,
  service_id UUID REFERENCES artisan_services(id) ON DELETE SET NULL,
  service_title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  unit_price INTEGER,
  line_total INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS artisan_quote_services_quote_idx ON artisan_quote_services(quote_id);

CREATE TABLE IF NOT EXISTS artisan_quote_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES artisan_quotes(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT artisan_quote_materials_qty_positive CHECK (quantity > 0),
  CONSTRAINT artisan_quote_materials_unit_price_nonneg CHECK (unit_price >= 0)
);
CREATE INDEX IF NOT EXISTS artisan_quote_materials_quote_idx ON artisan_quote_materials(quote_id);

-- ─── Factures ────────────────────────────────────────────────────────────────
-- Paiements : enregistrement comptable seul (pas d'encaissement PSP au portage).
CREATE TABLE IF NOT EXISTS artisan_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES artisan_quotes(id) ON DELETE RESTRICT,
  customer_name TEXT,
  customer_email TEXT,
  invoice_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  labor_total INTEGER NOT NULL DEFAULT 0,
  materials_total INTEGER NOT NULL DEFAULT 0,
  grand_total INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT artisan_invoices_quote_unique UNIQUE (quote_id)
);
CREATE INDEX IF NOT EXISTS artisan_invoices_org_idx ON artisan_invoices(organization_id);

CREATE TABLE IF NOT EXISTS artisan_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES artisan_invoices(id) ON DELETE CASCADE,
  line_kind TEXT NOT NULL CHECK (line_kind IN ('labor', 'service', 'material')),
  label TEXT NOT NULL,
  quantity INTEGER,
  unit_price INTEGER,
  line_total INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS artisan_invoice_lines_invoice_idx ON artisan_invoice_lines(invoice_id);

-- ─── updated_at (réutilise le trigger générique s'il existe, sinon le crée) ───
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS set_artisan_profiles_updated_at ON artisan_profiles;
CREATE TRIGGER set_artisan_profiles_updated_at BEFORE UPDATE ON artisan_profiles
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS set_artisan_services_updated_at ON artisan_services;
CREATE TRIGGER set_artisan_services_updated_at BEFORE UPDATE ON artisan_services
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS set_artisan_quotes_updated_at ON artisan_quotes;
CREATE TRIGGER set_artisan_quotes_updated_at BEFORE UPDATE ON artisan_quotes
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS set_artisan_invoices_updated_at ON artisan_invoices;
CREATE TRIGGER set_artisan_invoices_updated_at BEFORE UPDATE ON artisan_invoices
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─── RLS : accès réservé aux membres de l'organisation ───────────────────────
ALTER TABLE artisan_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_quote_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_quote_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_invoice_lines ENABLE ROW LEVEL SECURITY;

-- Tables scopées directement par organization_id
DROP POLICY IF EXISTS artisan_profiles_member ON artisan_profiles;
CREATE POLICY artisan_profiles_member ON artisan_profiles FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS artisan_services_member ON artisan_services;
CREATE POLICY artisan_services_member ON artisan_services FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS artisan_quotes_member ON artisan_quotes;
CREATE POLICY artisan_quotes_member ON artisan_quotes FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS artisan_invoices_member ON artisan_invoices;
CREATE POLICY artisan_invoices_member ON artisan_invoices FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

-- Tables filles : scopées via le devis / la facture parent
DROP POLICY IF EXISTS artisan_quote_services_member ON artisan_quote_services;
CREATE POLICY artisan_quote_services_member ON artisan_quote_services FOR ALL
  USING (EXISTS (SELECT 1 FROM artisan_quotes q
                 WHERE q.id = artisan_quote_services.quote_id AND is_org_member(q.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM artisan_quotes q
                 WHERE q.id = artisan_quote_services.quote_id AND is_org_member(q.organization_id)));

DROP POLICY IF EXISTS artisan_quote_materials_member ON artisan_quote_materials;
CREATE POLICY artisan_quote_materials_member ON artisan_quote_materials FOR ALL
  USING (EXISTS (SELECT 1 FROM artisan_quotes q
                 WHERE q.id = artisan_quote_materials.quote_id AND is_org_member(q.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM artisan_quotes q
                 WHERE q.id = artisan_quote_materials.quote_id AND is_org_member(q.organization_id)));

DROP POLICY IF EXISTS artisan_invoice_lines_member ON artisan_invoice_lines;
CREATE POLICY artisan_invoice_lines_member ON artisan_invoice_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM artisan_invoices i
                 WHERE i.id = artisan_invoice_lines.invoice_id AND is_org_member(i.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM artisan_invoices i
                 WHERE i.id = artisan_invoice_lines.invoice_id AND is_org_member(i.organization_id)));

COMMIT;

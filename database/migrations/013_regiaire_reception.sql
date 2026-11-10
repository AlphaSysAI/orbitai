-- ============================================
-- 013 — RégiAire : Réception / Stock (Feature 1, étape 1/2)
-- Dépend de Phase 0 : is_org_member (idempotent si déjà présent).
-- Idempotent. Exécuter dans Supabase SQL Editor.
-- ============================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Phase 0 — is_org_member (réutilisé par RLS tables + storage)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_org_member(p_organization_id UUID)
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
  );
$$;

COMMENT ON FUNCTION is_org_member(UUID) IS
  'True si l''utilisateur courant est membre de l''organisation.';

-- ---------------------------------------------------------------------------
-- Enum statut livraison
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE delivery_status AS ENUM (
    'draft',
    'scanning',
    'discrepancy',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Tables RégiAire Réception
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_organization_id ON suppliers(organization_id);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ean TEXT NOT NULL,
  name TEXT NOT NULL,
  has_dlc BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, ean)
);

CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);
CREATE INDEX IF NOT EXISTS idx_products_org_ean ON products(organization_id, ean);

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status delivery_status NOT NULL DEFAULT 'draft',
  bl_file_path TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deliveries_organization_id ON deliveries(organization_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_supplier_id ON deliveries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

CREATE TABLE IF NOT EXISTS delivery_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  raw_name TEXT NOT NULL,
  ean TEXT NOT NULL,
  expected_qty INTEGER NOT NULL CHECK (expected_qty >= 0),
  scanned_qty INTEGER NOT NULL DEFAULT 0 CHECK (scanned_qty >= 0),
  dlc DATE
);

CREATE INDEX IF NOT EXISTS idx_delivery_lines_delivery_id ON delivery_lines(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_lines_ean ON delivery_lines(ean);
CREATE INDEX IF NOT EXISTS idx_delivery_lines_product_id ON delivery_lines(product_id);

CREATE TABLE IF NOT EXISTS stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  dlc DATE,
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE RESTRICT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_batches_organization_id ON stock_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_product_id ON stock_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_delivery_id ON stock_batches(delivery_id);

COMMENT ON TABLE suppliers IS 'Fournisseurs RégiAire par organisation.';
COMMENT ON TABLE products IS 'Catalogue produits (EAN) par organisation.';
COMMENT ON TABLE deliveries IS 'Bon de livraison (réception) RégiAire.';
COMMENT ON TABLE delivery_lines IS 'Lignes extraites / scannées d''un BL.';
COMMENT ON TABLE stock_batches IS 'Lots en stock issus d''une réception validée.';

-- ---------------------------------------------------------------------------
-- RLS — isolation par organization_id (delivery_lines via delivery parente)
-- ---------------------------------------------------------------------------

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batches ENABLE ROW LEVEL SECURITY;

-- suppliers
DROP POLICY IF EXISTS "regiaire_suppliers_select" ON suppliers;
CREATE POLICY "regiaire_suppliers_select"
  ON suppliers FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_suppliers_insert" ON suppliers;
CREATE POLICY "regiaire_suppliers_insert"
  ON suppliers FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_suppliers_update" ON suppliers;
CREATE POLICY "regiaire_suppliers_update"
  ON suppliers FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_suppliers_delete" ON suppliers;
CREATE POLICY "regiaire_suppliers_delete"
  ON suppliers FOR DELETE
  USING (is_org_member(organization_id));

-- products
DROP POLICY IF EXISTS "regiaire_products_select" ON products;
CREATE POLICY "regiaire_products_select"
  ON products FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_products_insert" ON products;
CREATE POLICY "regiaire_products_insert"
  ON products FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_products_update" ON products;
CREATE POLICY "regiaire_products_update"
  ON products FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_products_delete" ON products;
CREATE POLICY "regiaire_products_delete"
  ON products FOR DELETE
  USING (is_org_member(organization_id));

-- deliveries
DROP POLICY IF EXISTS "regiaire_deliveries_select" ON deliveries;
CREATE POLICY "regiaire_deliveries_select"
  ON deliveries FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_deliveries_insert" ON deliveries;
CREATE POLICY "regiaire_deliveries_insert"
  ON deliveries FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_deliveries_update" ON deliveries;
CREATE POLICY "regiaire_deliveries_update"
  ON deliveries FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_deliveries_delete" ON deliveries;
CREATE POLICY "regiaire_deliveries_delete"
  ON deliveries FOR DELETE
  USING (is_org_member(organization_id));

-- delivery_lines (via deliveries.organization_id)
DROP POLICY IF EXISTS "regiaire_delivery_lines_select" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_select"
  ON delivery_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_org_member(d.organization_id)
    )
  );

DROP POLICY IF EXISTS "regiaire_delivery_lines_insert" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_insert"
  ON delivery_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_org_member(d.organization_id)
    )
  );

DROP POLICY IF EXISTS "regiaire_delivery_lines_update" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_update"
  ON delivery_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_org_member(d.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_org_member(d.organization_id)
    )
  );

DROP POLICY IF EXISTS "regiaire_delivery_lines_delete" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_delete"
  ON delivery_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_org_member(d.organization_id)
    )
  );

-- stock_batches
DROP POLICY IF EXISTS "regiaire_stock_batches_select" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_select"
  ON stock_batches FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_stock_batches_insert" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_insert"
  ON stock_batches FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_stock_batches_update" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_update"
  ON stock_batches FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_stock_batches_delete" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_delete"
  ON stock_batches FOR DELETE
  USING (is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Storage — bucket privé BL (chemin bl/{organization_id}/{delivery_id}/…)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'regiaire-bl',
  'regiaire-bl',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "regiaire_bl_select" ON storage.objects;
CREATE POLICY "regiaire_bl_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'regiaire-bl'
    AND (storage.foldername(name))[1] = 'bl'
    AND is_org_member(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "regiaire_bl_insert" ON storage.objects;
CREATE POLICY "regiaire_bl_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'regiaire-bl'
    AND (storage.foldername(name))[1] = 'bl'
    AND is_org_member(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "regiaire_bl_update" ON storage.objects;
CREATE POLICY "regiaire_bl_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'regiaire-bl'
    AND (storage.foldername(name))[1] = 'bl'
    AND is_org_member(((storage.foldername(name))[2])::uuid)
  )
  WITH CHECK (
    bucket_id = 'regiaire-bl'
    AND (storage.foldername(name))[1] = 'bl'
    AND is_org_member(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "regiaire_bl_delete" ON storage.objects;
CREATE POLICY "regiaire_bl_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'regiaire-bl'
    AND (storage.foldername(name))[1] = 'bl'
    AND is_org_member(((storage.foldername(name))[2])::uuid)
  );

COMMIT;

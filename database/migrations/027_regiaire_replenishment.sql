-- ============================================
-- 027 — RégiAire Verdict v2 : réappro (délai fournisseur + lien produit/fournisseur)
-- ============================================

BEGIN;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS lead_time_days INT NOT NULL DEFAULT 0
  CHECK (lead_time_days >= 0);

COMMENT ON COLUMN suppliers.lead_time_days IS
  'Délai de livraison en jours calendaires — réglé par le directeur.';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);

COMMENT ON COLUMN products.supplier_id IS
  'Fournisseur habituel — renseigné automatiquement à la réception (BL).';

COMMIT;

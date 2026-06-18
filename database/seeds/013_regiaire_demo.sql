-- ============================================
-- Seed démo RégiAire Réception (Feature 1)
-- Cible la première organisation avec module regiaire_core activé.
-- Idempotent (ON CONFLICT / guards). Exécuter après migration 013.
-- ============================================

BEGIN;

DO $$
DECLARE
  v_org_id UUID;
  v_owner_id UUID;
  v_supplier_id UUID;
  v_product_cafe UUID;
  v_product_croissant UUID;
  v_product_eau UUID;
  v_delivery_scanning UUID;
  v_delivery_draft UUID;
BEGIN
  SELECT om.organization_id INTO v_org_id
  FROM organization_modules om
  WHERE om.module_name = 'regiaire_core'
    AND om.is_enabled = true
  ORDER BY om.organization_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE '013_regiaire_demo: aucune org avec regiaire_core — seed ignoré.';
    RETURN;
  END IF;

  SELECT om.user_id INTO v_owner_id
  FROM organization_members om
  WHERE om.organization_id = v_org_id
    AND om.role = 'owner'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    SELECT om.user_id INTO v_owner_id
    FROM organization_members om
    WHERE om.organization_id = v_org_id
    LIMIT 1;
  END IF;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE '013_regiaire_demo: aucun membre pour org % — seed ignoré.', v_org_id;
    RETURN;
  END IF;

  -- Fournisseur démo
  SELECT id INTO v_supplier_id
  FROM suppliers
  WHERE organization_id = v_org_id
    AND name = 'Fournisseur Démo Shop'
  LIMIT 1;

  IF v_supplier_id IS NULL THEN
    INSERT INTO suppliers (organization_id, name, email)
    VALUES (
      v_org_id,
      'Fournisseur Démo Shop',
      'reception.demo@fournisseur.example'
    )
    RETURNING id INTO v_supplier_id;
  END IF;

  -- Produits (avec et sans DLC)
  INSERT INTO products (organization_id, ean, name, has_dlc)
  VALUES
    (v_org_id, '3017620422003', 'Nutella 750g', false),
    (v_org_id, '3760123456789', 'Croissants x6', true),
    (v_org_id, '3401560012345', 'Eau minérale 1,5L', true)
  ON CONFLICT (organization_id, ean) DO UPDATE SET
    name = EXCLUDED.name,
    has_dlc = EXCLUDED.has_dlc;

  SELECT id INTO v_product_cafe FROM products
  WHERE organization_id = v_org_id AND ean = '3017620422003';

  SELECT id INTO v_product_croissant FROM products
  WHERE organization_id = v_org_id AND ean = '3760123456789';

  SELECT id INTO v_product_eau FROM products
  WHERE organization_id = v_org_id AND ean = '3401560012345';

  -- Livraison #1 : scanning + lignes (test recordScan / finalize sans matériel)
  IF NOT EXISTS (
    SELECT 1 FROM deliveries
    WHERE organization_id = v_org_id
      AND supplier_id = v_supplier_id
      AND status = 'scanning'
      AND bl_file_path IS NULL
  ) THEN
    INSERT INTO deliveries (organization_id, supplier_id, status, created_by)
    VALUES (v_org_id, v_supplier_id, 'scanning', v_owner_id)
    RETURNING id INTO v_delivery_scanning;

    INSERT INTO delivery_lines (delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc)
    VALUES
      (v_delivery_scanning, v_product_cafe, 'Nutella 750g', '3017620422003', 12, 0, NULL),
      (v_delivery_scanning, v_product_croissant, 'Croissants x6', '3760123456789', 24, 0, CURRENT_DATE + 5),
      (v_delivery_scanning, v_product_eau, 'Eau minérale 1,5L', '3401560012345', 48, 0, CURRENT_DATE + 180);
  END IF;

  -- Livraison #2 : draft sans lignes (test analyzeBL + upload)
  IF NOT EXISTS (
    SELECT 1 FROM deliveries
    WHERE organization_id = v_org_id
      AND supplier_id = v_supplier_id
      AND status = 'draft'
  ) THEN
    INSERT INTO deliveries (organization_id, supplier_id, status, created_by)
    VALUES (v_org_id, v_supplier_id, 'draft', v_owner_id)
    RETURNING id INTO v_delivery_draft;
  END IF;

  RAISE NOTICE '013_regiaire_demo: seed appliqué pour org %.', v_org_id;
END $$;

COMMIT;

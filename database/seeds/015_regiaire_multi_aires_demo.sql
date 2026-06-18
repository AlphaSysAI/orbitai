-- ============================================
-- Seed démo RégiAire multi-aires (étape 2/2)
-- 3 aires pour l'org démo (style Dyneff) + données opérationnelles par site.
-- Exécuter après seeds 013 et 014. Idempotent.
-- ============================================

BEGIN;

DO $$
DECLARE
  v_org_id UUID;
  v_owner_id UUID;
  v_supplier_id UUID;
  v_aire_carcassonne UUID;
  v_aire_pamiers UUID;
  v_aire_castelnaudary UUID;
  v_product_croissant UUID;
  v_product_eau UUID;
  v_delivery_id UUID;
  v_days INT := 60;
  v_date DATE;
  v_dow INT;
  v_footfall NUMERIC(8, 2);
  v_aire_id UUID;
  i INT;
BEGIN
  SELECT om.organization_id INTO v_org_id
  FROM organization_modules om
  WHERE om.module_name = 'regiaire_core'
    AND om.is_enabled = true
  ORDER BY om.organization_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE '015_regiaire_multi_aires_demo: aucune org avec regiaire_core — seed ignoré.';
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

  SELECT id INTO v_product_croissant FROM products
  WHERE organization_id = v_org_id AND ean = '3760123456789';

  SELECT id INTO v_product_eau FROM products
  WHERE organization_id = v_org_id AND ean = '3401560012345';

  -- Aire 1 — Carcassonne (zone C, seed 014)
  SELECT a.id INTO v_aire_carcassonne
  FROM aires a
  WHERE a.organization_id = v_org_id
    AND a.city ILIKE '%Carcassonne%'
  LIMIT 1;

  IF v_aire_carcassonne IS NULL THEN
    INSERT INTO aires (organization_id, name, lat, lon, city, school_zone, order_days)
    VALUES (
      v_org_id,
      'Aire du Lauragais — Carcassonne',
      43.212800,
      2.353700,
      'Carcassonne',
      'C',
      ARRAY[1, 3, 5]
    )
    RETURNING id INTO v_aire_carcassonne;
  END IF;

  -- Aire 2 — Pamiers (zone A)
  SELECT a.id INTO v_aire_pamiers
  FROM aires a
  WHERE a.organization_id = v_org_id
    AND a.city ILIKE '%Pamiers%'
  LIMIT 1;

  IF v_aire_pamiers IS NULL THEN
    INSERT INTO aires (organization_id, name, lat, lon, city, school_zone, order_days)
    VALUES (
      v_org_id,
      'Aire de Pamiers',
      43.116700,
      1.616700,
      'Pamiers',
      'A',
      ARRAY[2, 4, 6]
    )
    RETURNING id INTO v_aire_pamiers;
  END IF;

  -- Aire 3 — Castelnaudary (zone B)
  SELECT a.id INTO v_aire_castelnaudary
  FROM aires a
  WHERE a.organization_id = v_org_id
    AND a.city ILIKE '%Castelnaudary%'
  LIMIT 1;

  IF v_aire_castelnaudary IS NULL THEN
    INSERT INTO aires (organization_id, name, lat, lon, city, school_zone, order_days)
    VALUES (
      v_org_id,
      'Aire de Castelnaudary',
      43.317000,
      1.954000,
      'Castelnaudary',
      'B',
      ARRAY[1, 2, 3, 4, 5]
    )
    RETURNING id INTO v_aire_castelnaudary;
  END IF;

  -- Livraison draft — Pamiers
  IF NOT EXISTS (
    SELECT 1 FROM deliveries
    WHERE organization_id = v_org_id
      AND aire_id = v_aire_pamiers
      AND status = 'draft'
  ) THEN
    INSERT INTO deliveries (organization_id, aire_id, supplier_id, status, created_by)
    VALUES (v_org_id, v_aire_pamiers, v_supplier_id, 'draft', v_owner_id);
  END IF;

  -- Stock proche péremption — Pamiers (aperçu dashboard)
  IF v_product_croissant IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM stock_batches
    WHERE organization_id = v_org_id
      AND aire_id = v_aire_pamiers
      AND product_id = v_product_croissant
      AND dlc = CURRENT_DATE + 2
  ) THEN
    INSERT INTO stock_batches (organization_id, aire_id, product_id, quantity, dlc)
    VALUES (v_org_id, v_aire_pamiers, v_product_croissant, 8, CURRENT_DATE + 2);
  END IF;

  IF v_product_eau IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM stock_batches
    WHERE organization_id = v_org_id
      AND aire_id = v_aire_pamiers
      AND product_id = v_product_eau
      AND dlc = CURRENT_DATE - 1
  ) THEN
    INSERT INTO stock_batches (organization_id, aire_id, product_id, quantity, dlc)
    VALUES (v_org_id, v_aire_pamiers, v_product_eau, 3, CURRENT_DATE - 1);
  END IF;

  -- Livraison scanning — Castelnaudary
  IF NOT EXISTS (
    SELECT 1 FROM deliveries
    WHERE organization_id = v_org_id
      AND aire_id = v_aire_castelnaudary
      AND status = 'scanning'
  ) THEN
    INSERT INTO deliveries (organization_id, aire_id, supplier_id, status, created_by)
    VALUES (v_org_id, v_aire_castelnaudary, v_supplier_id, 'scanning', v_owner_id)
    RETURNING id INTO v_delivery_id;

    IF v_product_croissant IS NOT NULL THEN
      INSERT INTO delivery_lines (delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc)
      VALUES (
        v_delivery_id,
        v_product_croissant,
        'Croissants x6',
        '3760123456789',
        18,
        0,
        CURRENT_DATE + 4
      );
    END IF;

    IF v_product_eau IS NOT NULL THEN
      INSERT INTO delivery_lines (delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc)
      VALUES (
        v_delivery_id,
        v_product_eau,
        'Eau minérale 1,5L',
        '3401560012345',
        36,
        0,
        CURRENT_DATE + 120
      );
    END IF;
  END IF;

  -- Trafic simulé léger (60 j) — Pamiers + Castelnaudary
  FOREACH v_aire_id IN ARRAY ARRAY[v_aire_pamiers, v_aire_castelnaudary] LOOP
    DELETE FROM traffic_signals
    WHERE aire_id = v_aire_id
      AND signal_date >= CURRENT_DATE - (v_days - 1);

    FOR i IN 0..(v_days - 1) LOOP
      v_date := CURRENT_DATE - i;
      v_dow := EXTRACT(ISODOW FROM v_date)::INT;
      v_footfall := ROUND(
        (95.0 * CASE v_dow WHEN 6 THEN 1.15 WHEN 7 THEN 1.20 ELSE 1.0 END
         * (0.92 + random() * 0.16))::NUMERIC,
        2
      );

      INSERT INTO traffic_signals (organization_id, aire_id, signal_date, footfall_index)
      VALUES (v_org_id, v_aire_id, v_date, v_footfall)
      ON CONFLICT (aire_id, signal_date) DO UPDATE SET
        footfall_index = EXCLUDED.footfall_index;
    END LOOP;
  END LOOP;

  RAISE NOTICE '015_regiaire_multi_aires_demo: 3 aires + données par site pour org %.',
    v_org_id;
END $$;

COMMIT;

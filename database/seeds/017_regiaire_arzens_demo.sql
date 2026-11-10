-- ============================================
-- Seed démo RégiAire — Aire Arzens SUD (référence tests)
-- Aire fixe : 7ec3c50b-4893-4904-90d2-56e0ab04532a
-- Org       : bba39426-6f78-4750-a77a-f5c0c991a878
--
-- DONNÉES SIMULÉES : trafic, ventes (~400 j), stock, réceptions démo.
-- Exécuter après migrations 020+ et 027 (lead_time_days / supplier_id).
-- Idempotent (DELETE ciblé sur cette aire + upserts catalogue).
-- ============================================

BEGIN;

DO $$
DECLARE
  -- Référence tests OrbitAI / Verdict v2
  v_aire_id UUID := '7ec3c50b-4893-4904-90d2-56e0ab04532a';
  v_org_id UUID := 'bba39426-6f78-4750-a77a-f5c0c991a878';

  v_owner_id UUID;
  v_supplier_id UUID;
  v_product_nutella UUID;
  v_product_croissant UUID;
  v_product_eau UUID;
  v_delivery_stock UUID;
  v_delivery_scanning UUID;
  v_days INT := 400;
  v_date DATE;
  v_dow INT;
  v_footfall NUMERIC(8, 2);
  v_dow_mult NUMERIC;
  v_weekend_bonus NUMERIC;
  v_noise NUMERIC;
  v_product RECORD;
  v_base_qty NUMERIC;
  v_qty INT;
  i INT;
  v_aire_org UUID;
BEGIN
  SELECT organization_id INTO v_aire_org
  FROM aires
  WHERE id = v_aire_id;

  IF v_aire_org IS NULL THEN
    RAISE NOTICE '017_regiaire_arzens_demo: aire % introuvable — seed ignoré.', v_aire_id;
    RETURN;
  END IF;

  IF v_aire_org <> v_org_id THEN
    RAISE EXCEPTION
      '017_regiaire_arzens_demo: aire % appartient à org %, attendu %.',
      v_aire_id, v_aire_org, v_org_id;
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
    RAISE NOTICE '017_regiaire_arzens_demo: aucun membre pour org % — seed ignoré.', v_org_id;
    RETURN;
  END IF;

  -- Paramètres Verdict / Bison Futé (Sud-Ouest)
  UPDATE aires SET
    bison_fute_zone = COALESCE(bison_fute_zone, 5),
    school_zone = COALESCE(school_zone, 'B'),
    order_days = COALESCE(order_days, ARRAY[1, 3, 5])
  WHERE id = v_aire_id;

  -- Fournisseur démo + délai livraison (réappro)
  SELECT id INTO v_supplier_id
  FROM suppliers
  WHERE organization_id = v_org_id
    AND name = 'Fournisseur Démo Shop'
  LIMIT 1;

  IF v_supplier_id IS NULL THEN
    INSERT INTO suppliers (organization_id, name, email, lead_time_days)
    VALUES (
      v_org_id,
      'Fournisseur Démo Shop',
      'reception.demo@fournisseur.example',
      2
    )
    RETURNING id INTO v_supplier_id;
  ELSE
    UPDATE suppliers SET lead_time_days = 2 WHERE id = v_supplier_id;
  END IF;

  INSERT INTO products (organization_id, ean, name, has_dlc, category, supplier_id)
  VALUES
    (v_org_id, '3017620422003', 'Nutella 750g', false, 'Épicerie sucrée', v_supplier_id),
    (v_org_id, '3760123456789', 'Croissants x6', true, 'Boulangerie', v_supplier_id),
    (v_org_id, '3401560012345', 'Eau minérale 1,5L', true, 'Boissons', v_supplier_id)
  ON CONFLICT (organization_id, ean) DO UPDATE SET
    name = EXCLUDED.name,
    has_dlc = EXCLUDED.has_dlc,
    category = EXCLUDED.category,
    supplier_id = EXCLUDED.supplier_id;

  SELECT id INTO v_product_nutella FROM products
  WHERE organization_id = v_org_id AND ean = '3017620422003';

  SELECT id INTO v_product_croissant FROM products
  WHERE organization_id = v_org_id AND ean = '3760123456789';

  SELECT id INTO v_product_eau FROM products
  WHERE organization_id = v_org_id AND ean = '3401560012345';

  -- Reset données simulées sur cette aire uniquement
  DELETE FROM sales_history WHERE aire_id = v_aire_id;
  DELETE FROM traffic_signals WHERE aire_id = v_aire_id;
  DELETE FROM stock_batches WHERE aire_id = v_aire_id;

  -- Trafic ~400 jours
  FOR i IN 0..(v_days - 1) LOOP
    v_date := CURRENT_DATE - i;
    v_dow := EXTRACT(ISODOW FROM v_date)::INT;

    v_dow_mult := CASE v_dow
      WHEN 1 THEN 0.92
      WHEN 2 THEN 0.95
      WHEN 3 THEN 1.00
      WHEN 4 THEN 1.03
      WHEN 5 THEN 1.08
      WHEN 6 THEN 1.18
      WHEN 7 THEN 1.22
      ELSE 1.00
    END;

    v_weekend_bonus := CASE WHEN v_dow IN (6, 7) THEN 1.05 ELSE 1.00 END;
    v_noise := 0.94 + (random() * 0.12);
    v_footfall := ROUND(
      (100.0 * v_dow_mult * v_weekend_bonus * v_noise)::NUMERIC,
      2
    );

    INSERT INTO traffic_signals (organization_id, aire_id, signal_date, footfall_index)
    VALUES (v_org_id, v_aire_id, v_date, v_footfall)
    ON CONFLICT (aire_id, signal_date) DO UPDATE SET
      footfall_index = EXCLUDED.footfall_index;
  END LOOP;

  -- Ventes corrélées au trafic
  FOR v_product IN
    SELECT p.id, COALESCE(p.category, 'Divers') AS category
    FROM products p
    WHERE p.organization_id = v_org_id
      AND p.ean IN ('3017620422003', '3760123456789', '3401560012345')
  LOOP
    v_base_qty := CASE v_product.category
      WHEN 'Boissons' THEN 18
      WHEN 'Boulangerie' THEN 14
      WHEN 'Épicerie sucrée' THEN 10
      ELSE 8
    END;

    FOR i IN 0..(v_days - 1) LOOP
      v_date := CURRENT_DATE - i;

      SELECT ts.footfall_index INTO v_footfall
      FROM traffic_signals ts
      WHERE ts.aire_id = v_aire_id AND ts.signal_date = v_date;

      IF v_footfall IS NULL THEN
        CONTINUE;
      END IF;

      v_qty := GREATEST(
        0,
        ROUND(
          (v_base_qty * (v_footfall / 100.0) * (0.88 + random() * 0.24))::NUMERIC
        )::INT
      );

      INSERT INTO sales_history (organization_id, aire_id, product_id, sale_date, quantity)
      VALUES (v_org_id, v_aire_id, v_product.id, v_date, v_qty);
    END LOOP;
  END LOOP;

  -- Stock réel (lots) — issu d'une livraison finalisée (delivery_id NOT NULL)
  SELECT id INTO v_delivery_stock
  FROM deliveries
  WHERE organization_id = v_org_id
    AND aire_id = v_aire_id
    AND status = 'completed'
    AND bl_file_path = 'seed:017_arzens_stock'
  LIMIT 1;

  IF v_delivery_stock IS NULL THEN
    INSERT INTO deliveries (
      organization_id, aire_id, supplier_id, status, created_by,
      completed_at, bl_file_path
    )
    VALUES (
      v_org_id, v_aire_id, v_supplier_id, 'completed', v_owner_id,
      NOW(), 'seed:017_arzens_stock'
    )
    RETURNING id INTO v_delivery_stock;
  END IF;

  INSERT INTO stock_batches (
    organization_id, aire_id, product_id, quantity, dlc, delivery_id
  )
  VALUES
    (v_org_id, v_aire_id, v_product_eau, 12, CURRENT_DATE + 90, v_delivery_stock),
    (v_org_id, v_aire_id, v_product_croissant, 8, CURRENT_DATE + 3, v_delivery_stock),
    (v_org_id, v_aire_id, v_product_nutella, 24, NULL, v_delivery_stock);

  -- Livraison scanning (réception)
  IF NOT EXISTS (
    SELECT 1 FROM deliveries
    WHERE organization_id = v_org_id
      AND aire_id = v_aire_id
      AND supplier_id = v_supplier_id
      AND status = 'scanning'
      AND bl_file_path IS NULL
  ) THEN
    INSERT INTO deliveries (organization_id, aire_id, supplier_id, status, created_by)
    VALUES (v_org_id, v_aire_id, v_supplier_id, 'scanning', v_owner_id)
    RETURNING id INTO v_delivery_scanning;

    INSERT INTO delivery_lines (delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc)
    VALUES
      (v_delivery_scanning, v_product_nutella, 'Nutella 750g', '3017620422003', 12, 0, NULL),
      (v_delivery_scanning, v_product_croissant, 'Croissants x6', '3760123456789', 24, 0, CURRENT_DATE + 5),
      (v_delivery_scanning, v_product_eau, 'Eau minérale 1,5L', '3401560012345', 48, 0, CURRENT_DATE + 180);
  END IF;

  -- Livraison draft (analyze BL)
  IF NOT EXISTS (
    SELECT 1 FROM deliveries
    WHERE organization_id = v_org_id
      AND aire_id = v_aire_id
      AND supplier_id = v_supplier_id
      AND status = 'draft'
  ) THEN
    INSERT INTO deliveries (organization_id, aire_id, supplier_id, status, created_by)
    VALUES (v_org_id, v_aire_id, v_supplier_id, 'draft', v_owner_id);
  END IF;

  RAISE NOTICE '017_regiaire_arzens_demo: OK aire=% (% j trafic + ventes, stock, réceptions).',
    v_aire_id, v_days;
END $$;

-- Prévisions Bison Futé zone 5 (aire Arzens)
INSERT INTO bison_fute_forecast (forecast_date, zone, direction, level)
VALUES
  ('2026-07-30', 5, 'aller', 'rouge'),
  ('2026-07-30', 5, 'retour', 'orange'),
  ('2026-08-01', 5, 'aller', 'rouge'),
  ('2026-08-01', 5, 'retour', 'rouge'),
  ('2026-08-06', 5, 'aller', 'noir'),
  ('2026-08-06', 5, 'retour', 'rouge'),
  ('2026-06-20', 5, 'aller', 'vert'),
  ('2026-06-20', 5, 'retour', 'vert'),
  (CURRENT_DATE, 5, 'aller', 'orange'),
  (CURRENT_DATE, 5, 'retour', 'orange')
ON CONFLICT (forecast_date, zone, direction)
DO UPDATE SET level = EXCLUDED.level;

COMMIT;

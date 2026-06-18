-- ============================================
-- Seed démo RégiAire Verdict IA (Feature 2 — étape 1)
-- DONNÉES SIMULÉES : traffic_signals + sales_history (~400 jours).
-- À remplacer par des flux réels (caisse / comptage fréquentation).
-- Exécuter après migration 020 (+ seed 013 recommandé).
-- Idempotent (DELETE ciblé + ON CONFLICT).
-- ============================================

BEGIN;

DO $$
DECLARE
  v_org_id UUID;
  v_aire_id UUID;
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
BEGIN
  SELECT om.organization_id INTO v_org_id
  FROM organization_modules om
  WHERE om.module_name = 'regiaire_core'
    AND om.is_enabled = true
  ORDER BY om.organization_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE '014_regiaire_verdict_demo: aucune org avec regiaire_core — seed ignoré.';
    RETURN;
  END IF;

  -- Catégories sur produits démo existants
  UPDATE products SET category = 'Épicerie sucrée'
  WHERE organization_id = v_org_id AND ean = '3017620422003';

  UPDATE products SET category = 'Boulangerie'
  WHERE organization_id = v_org_id AND ean = '3760123456789';

  UPDATE products SET category = 'Boissons'
  WHERE organization_id = v_org_id AND ean = '3401560012345';

  UPDATE products SET category = COALESCE(category, 'Divers')
  WHERE organization_id = v_org_id AND category IS NULL;

  -- Aire démo — près de Carcassonne (zone scolaire C)
  SELECT a.id INTO v_aire_id
  FROM aires a
  WHERE a.organization_id = v_org_id
  ORDER BY a.created_at ASC
  LIMIT 1;

  IF v_aire_id IS NULL THEN
    INSERT INTO aires (
      organization_id, name, lat, lon, city, school_zone, order_days
    )
    VALUES (
      v_org_id,
      'Aire du Lauragais — Carcassonne',
      43.212800,
      2.353700,
      'Aire du Lauragais — Carcassonne',
      'C',
      ARRAY[1, 3, 5]
    )
    RETURNING id INTO v_aire_id;
  ELSE
    UPDATE aires SET
      name = 'Aire du Lauragais — Carcassonne',
      lat = 43.212800,
      lon = 2.353700,
      city = 'Aire du Lauragais — Carcassonne',
      school_zone = 'C',
      order_days = ARRAY[1, 3, 5]
    WHERE id = v_aire_id;
  END IF;

  -- Reset seed simulé (trafic + ventes) pour re-seed idempotent
  DELETE FROM sales_history WHERE aire_id = v_aire_id;
  DELETE FROM traffic_signals WHERE aire_id = v_aire_id;

  -- ~400 jours de trafic simulé (couvre N-1 pour tendances alignées)
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

    -- Légère variation saisonnière + bruit
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

  -- Ventes corrélées au trafic (~400 jours × produits)
  FOR v_product IN
    SELECT p.id,
           p.ean,
           COALESCE(p.category, 'Divers') AS category
    FROM products p
    WHERE p.organization_id = v_org_id
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
      WHERE ts.aire_id = v_aire_id
        AND ts.signal_date = v_date;

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

  RAISE NOTICE '014_regiaire_verdict_demo: seed OK org=% (% j trafic + ventes simulés).',
    v_org_id, v_days;
END $$;

COMMIT;

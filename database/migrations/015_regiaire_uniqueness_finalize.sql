-- ============================================
-- 015 — RégiAire Réception : unicité lignes + finalisation stock-toujours
-- Idempotent. Exécuter dans Supabase SQL Editor (après 014).
-- ============================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Unicité : une ligne par EAN par livraison
-- ---------------------------------------------------------------------------

-- Fusion préalable des doublons éventuels (somme expected_qty, max scanned_qty)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM delivery_lines
    GROUP BY delivery_id, ean
    HAVING COUNT(*) > 1
  ) THEN
    CREATE TEMP TABLE _dl_dedupe ON COMMIT DROP AS
    SELECT
      MIN(id) AS keep_id,
      delivery_id,
      ean,
      SUM(expected_qty)::integer AS expected_qty,
      MAX(scanned_qty)::integer AS scanned_qty,
      MAX(dlc) AS dlc,
      MAX(product_id::text)::uuid AS product_id,
      MIN(raw_name) AS raw_name
    FROM delivery_lines
    GROUP BY delivery_id, ean
    HAVING COUNT(*) > 1;

    UPDATE delivery_lines dl
    SET
      expected_qty = d.expected_qty,
      scanned_qty = d.scanned_qty,
      dlc = d.dlc,
      product_id = d.product_id,
      raw_name = d.raw_name
    FROM _dl_dedupe d
    WHERE dl.id = d.keep_id;

    DELETE FROM delivery_lines dl
    USING _dl_dedupe d
    WHERE dl.delivery_id = d.delivery_id
      AND dl.ean = d.ean
      AND dl.id <> d.keep_id;
  END IF;
END $$;

ALTER TABLE delivery_lines
  DROP CONSTRAINT IF EXISTS delivery_lines_delivery_id_ean_key;

ALTER TABLE delivery_lines
  ADD CONSTRAINT delivery_lines_delivery_id_ean_key UNIQUE (delivery_id, ean);

CREATE INDEX IF NOT EXISTS idx_delivery_lines_delivery_ean
  ON delivery_lines(delivery_id, ean);

-- ---------------------------------------------------------------------------
-- Finalisation : claim depuis scanning uniquement, stock toujours, état terminal
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION regiaire_finalize_delivery(p_delivery_id uuid)
RETURNS TABLE (outcome text, batches_created integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status delivery_status;
  v_org_id uuid;
  v_has_discrepancy boolean := false;
  v_batches integer := 0;
  v_line record;
BEGIN
  SELECT d.status, d.organization_id
  INTO v_status, v_org_id
  FROM deliveries d
  WHERE d.id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'delivery_not_found';
  END IF;

  IF v_status <> 'scanning' THEN
    outcome := 'already_finalized';
    batches_created := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM delivery_lines dl WHERE dl.delivery_id = p_delivery_id
  ) THEN
    RAISE EXCEPTION 'no_lines';
  END IF;

  FOR v_line IN
    SELECT dl.expected_qty, dl.scanned_qty, dl.product_id
    FROM delivery_lines dl
    WHERE dl.delivery_id = p_delivery_id
  LOOP
    IF v_line.scanned_qty > 0 AND v_line.product_id IS NULL THEN
      v_has_discrepancy := true;
    ELSIF v_line.expected_qty = 0 AND v_line.scanned_qty > 0 THEN
      v_has_discrepancy := true;
    ELSIF v_line.expected_qty > 0 AND v_line.scanned_qty IS DISTINCT FROM v_line.expected_qty THEN
      v_has_discrepancy := true;
    END IF;
  END LOOP;

  INSERT INTO stock_batches (organization_id, product_id, quantity, dlc, delivery_id)
  SELECT v_org_id, dl.product_id, dl.scanned_qty, dl.dlc, p_delivery_id
  FROM delivery_lines dl
  WHERE dl.delivery_id = p_delivery_id
    AND dl.scanned_qty > 0
    AND dl.product_id IS NOT NULL;

  GET DIAGNOSTICS v_batches = ROW_COUNT;

  IF v_batches = 0 THEN
    RAISE EXCEPTION 'no_scanned_stock';
  END IF;

  IF v_has_discrepancy THEN
    UPDATE deliveries
    SET status = 'discrepancy',
        completed_at = NOW()
    WHERE id = p_delivery_id;

    outcome := 'discrepancy';
  ELSE
    UPDATE deliveries
    SET status = 'completed',
        completed_at = NOW()
    WHERE id = p_delivery_id;

    outcome := 'completed';
  END IF;

  batches_created := v_batches;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION regiaire_finalize_delivery(uuid) IS
  'Finalise depuis scanning : stock_batches toujours, completed ou discrepancy (terminal).';

COMMIT;

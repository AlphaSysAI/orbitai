-- ============================================
-- 014 — RégiAire Réception : RPC atomiques scan + finalisation
-- SECURITY INVOKER — RLS de l'appelant appliquée.
-- Idempotent. Exécuter dans Supabase SQL Editor.
-- ============================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Incrément scan atomique (évite read-then-write concurrent)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION regiaire_increment_scan(
  p_line_id uuid,
  p_allow_extra boolean,
  p_dlc date
)
RETURNS SETOF delivery_lines
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE delivery_lines
  SET scanned_qty = scanned_qty + 1,
      dlc = COALESCE(delivery_lines.dlc, p_dlc)
  WHERE id = p_line_id
    AND (p_allow_extra OR scanned_qty < expected_qty)
  RETURNING *;
$$;

COMMENT ON FUNCTION regiaire_increment_scan(uuid, boolean, date) IS
  'Incrémente scanned_qty d''une ligne BL si le plafond le permet (atomique, RLS invoker).';

-- ---------------------------------------------------------------------------
-- Finalisation transactionnelle (transition + stock_batches)
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

  IF v_status NOT IN ('scanning', 'discrepancy') THEN
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
    IF v_line.expected_qty IS DISTINCT FROM v_line.scanned_qty
       OR (v_line.scanned_qty > 0 AND v_line.product_id IS NULL)
    THEN
      v_has_discrepancy := true;
      EXIT;
    END IF;
  END LOOP;

  IF v_has_discrepancy THEN
    UPDATE deliveries
    SET status = 'discrepancy'
    WHERE id = p_delivery_id;

    outcome := 'discrepancy';
    batches_created := 0;
    RETURN NEXT;
    RETURN;
  END IF;

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

  UPDATE deliveries
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = p_delivery_id;

  outcome := 'completed';
  batches_created := v_batches;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION regiaire_finalize_delivery(uuid) IS
  'Finalise une réception en une transaction : écart → discrepancy, conforme → stock_batches + completed.';

COMMIT;

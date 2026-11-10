-- ============================================
-- 017 — RégiAire Réception : décrément scan atomique
-- SECURITY INVOKER — RLS de l'appelant appliquée.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION regiaire_decrement_scan(p_line_id uuid)
RETURNS SETOF delivery_lines
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE delivery_lines
  SET scanned_qty = scanned_qty - 1
  WHERE id = p_line_id
    AND scanned_qty > 0
  RETURNING *;
$$;

COMMENT ON FUNCTION regiaire_decrement_scan(uuid) IS
  'Décrémente scanned_qty d''une ligne BL (atomique, RLS invoker). 0 ligne = rien à annuler.';

COMMIT;

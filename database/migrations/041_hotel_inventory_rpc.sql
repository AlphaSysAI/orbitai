-- ============================================
-- 041 — Orbit Hôtel : garde anti-surbooking niveau TYPE (concurrency-safe)
--
-- Phase 2, lot 6. Porté de l'esprit de 030_pms_rpc. Réserve/libère l'inventaire
-- par type de chambre et par nuit, de façon atomique et concurrency-safe
-- (INSERT ON CONFLICT DO NOTHING pour matérialiser la ligne + SELECT FOR UPDATE
-- pour la verrouiller). Empêche de vendre plus de chambres d'un type qu'il n'en
-- existe (physiques actives) pour une date donnée.
--
-- SECURITY DEFINER (contourne la RLS pour lock/écrire l'inventaire) MAIS vérifie
-- l'appartenance de l'appelant à l'organisation (is_org_member) → pas d'abus
-- inter-tenant même en appel RPC direct.
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION hotel_reserve_inventory(
  p_org UUID,
  p_items JSONB,        -- [{ "room_type_id": uuid, "check_in": date, "check_out": date }]
  p_release BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  d DATE;
  ci DATE;
  co DATE;
  rt UUID;
  v_total INT;
  v_sold INT;
BEGIN
  -- Garde inter-tenant : l'appelant doit être membre de l'organisation.
  IF NOT is_org_member(p_org) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    rt := (item->>'room_type_id')::UUID;
    ci := (item->>'check_in')::DATE;
    co := (item->>'check_out')::DATE;
    d := ci;
    WHILE d < co LOOP
      -- Matérialise la ligne d'inventaire si absente.
      INSERT INTO hotel_inventory_calendar (organization_id, room_type_id, date, total, sold)
      VALUES (p_org, rt, d, 0, 0)
      ON CONFLICT (organization_id, room_type_id, date) DO NOTHING;

      -- Verrouille la ligne pour la durée de la transaction.
      SELECT sold INTO v_sold
      FROM hotel_inventory_calendar
      WHERE organization_id = p_org AND room_type_id = rt AND date = d
      FOR UPDATE;

      -- Total = nombre de chambres physiques actives de ce type (toujours à jour).
      v_total := (
        SELECT count(*) FROM hotel_rooms
        WHERE organization_id = p_org AND room_type_id = rt AND is_active
      );

      IF NOT p_release AND v_sold + 1 > v_total THEN
        RAISE EXCEPTION 'no_inventory' USING ERRCODE = 'check_violation';
      END IF;

      UPDATE hotel_inventory_calendar
        SET total = v_total,
            sold = GREATEST(0, sold + CASE WHEN p_release THEN -1 ELSE 1 END),
            updated_at = NOW()
      WHERE organization_id = p_org AND room_type_id = rt AND date = d;

      d := d + 1;
    END LOOP;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION hotel_reserve_inventory(UUID, JSONB, BOOLEAN) TO authenticated;

COMMIT;

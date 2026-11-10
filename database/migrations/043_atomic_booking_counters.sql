-- ============================================
-- 043 — Robustesse : compteurs atomiques + booking atomique (F1/F2 de l'audit)
--
-- F2 : numérotation concurrency-safe (org_counters + next_counter).
-- F1 : réservation atomique (hotel_create_reservation) — inventaire + dossier
--      + chambres + nuits + folio dans UNE transaction (pas de dossier orphelin,
--      pas d'inventaire décrémenté en cas d'échec).
-- Fonctions SECURITY DEFINER gardées par is_org_member(p_org).
-- ============================================

BEGIN;

-- ─── Compteur séquentiel atomique par (org, scope, année) ────────────────────
CREATE TABLE IF NOT EXISTS org_counters (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  year INT NOT NULL,
  last_value INT NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, scope, year)
);
ALTER TABLE org_counters ENABLE ROW LEVEL SECURITY;
-- Aucune policy : accès uniquement via next_counter() (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION next_counter(p_org UUID, p_scope TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM now())::INT;
  v_val INT;
BEGIN
  IF NOT is_org_member(p_org) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO org_counters (organization_id, scope, year, last_value)
  VALUES (p_org, p_scope, v_year, 1)
  ON CONFLICT (organization_id, scope, year)
  DO UPDATE SET last_value = org_counters.last_value + 1
  RETURNING last_value INTO v_val;
  RETURN v_val;
END $$;
GRANT EXECUTE ON FUNCTION next_counter(UUID, TEXT) TO authenticated;

-- ─── Booking atomique ────────────────────────────────────────────────────────
-- p_payload = {
--   customer_name, customer_email, status, check_in, check_out, adults, children,
--   rooms: [{ room_type_id, rate_plan_id, guest_name, occupants, night_prices:[int...] }]
-- }
-- Retourne { id, reference }. Lève 'no_inventory' / 'invalid_room_type' /
-- 'invalid_rate_plan' / 'invalid_dates' — tout est rollback (atomique).
CREATE OR REPLACE FUNCTION hotel_create_reservation(p_org UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ci DATE := (p_payload->>'check_in')::DATE;
  v_co DATE := (p_payload->>'check_out')::DATE;
  v_status hotel_reservation_status := COALESCE((p_payload->>'status')::hotel_reservation_status, 'confirmed');
  v_ref TEXT;
  v_seq INT;
  v_res_id UUID;
  v_total INT := 0;
  room JSONB;
  v_rt UUID;
  v_rp UUID;
  v_rr_id UUID;
  d DATE;
  i INT;
  v_price INT;
  v_sold INT;
  v_cap INT;
BEGIN
  IF NOT is_org_member(p_org) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_co <= v_ci THEN RAISE EXCEPTION 'invalid_dates'; END IF;

  -- 1) Inventaire (verrous) + total.
  FOR room IN SELECT * FROM jsonb_array_elements(p_payload->'rooms') LOOP
    v_rt := (room->>'room_type_id')::UUID;
    v_rp := (room->>'rate_plan_id')::UUID;
    IF NOT EXISTS (SELECT 1 FROM hotel_room_types WHERE id = v_rt AND organization_id = p_org) THEN
      RAISE EXCEPTION 'invalid_room_type';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM hotel_rate_plans WHERE id = v_rp AND organization_id = p_org) THEN
      RAISE EXCEPTION 'invalid_rate_plan';
    END IF;

    d := v_ci; i := 0;
    WHILE d < v_co LOOP
      INSERT INTO hotel_inventory_calendar (organization_id, room_type_id, date, total, sold)
        VALUES (p_org, v_rt, d, 0, 0)
        ON CONFLICT (organization_id, room_type_id, date) DO NOTHING;
      SELECT sold INTO v_sold FROM hotel_inventory_calendar
        WHERE organization_id = p_org AND room_type_id = v_rt AND date = d FOR UPDATE;
      v_cap := (SELECT count(*) FROM hotel_rooms
                WHERE organization_id = p_org AND room_type_id = v_rt AND is_active);
      IF v_sold + 1 > v_cap THEN RAISE EXCEPTION 'no_inventory'; END IF;
      UPDATE hotel_inventory_calendar
        SET total = v_cap, sold = sold + 1, updated_at = now()
        WHERE organization_id = p_org AND room_type_id = v_rt AND date = d;
      v_total := v_total + COALESCE((room->'night_prices'->>i)::INT, 0);
      d := d + 1; i := i + 1;
    END LOOP;
  END LOOP;

  -- 2) Référence atomique.
  INSERT INTO org_counters (organization_id, scope, year, last_value)
  VALUES (p_org, 'hotel_reservation', EXTRACT(YEAR FROM now())::INT, 1)
  ON CONFLICT (organization_id, scope, year)
  DO UPDATE SET last_value = org_counters.last_value + 1
  RETURNING last_value INTO v_seq;
  v_ref := 'R-' || EXTRACT(YEAR FROM now())::INT || '-' || lpad(v_seq::TEXT, 4, '0');

  -- 3) Dossier.
  INSERT INTO hotel_reservations (
    organization_id, reference, customer_name, customer_email, status,
    check_in, check_out, adults, children, total_cents, balance_cents
  ) VALUES (
    p_org, v_ref,
    NULLIF(p_payload->>'customer_name', ''),
    NULLIF(p_payload->>'customer_email', ''),
    v_status, v_ci, v_co,
    GREATEST(0, COALESCE((p_payload->>'adults')::INT, 1)),
    GREATEST(0, COALESCE((p_payload->>'children')::INT, 0)),
    v_total, v_total
  ) RETURNING id INTO v_res_id;

  -- 4) Chambres + nuits.
  FOR room IN SELECT * FROM jsonb_array_elements(p_payload->'rooms') LOOP
    v_rt := (room->>'room_type_id')::UUID;
    v_rp := (room->>'rate_plan_id')::UUID;
    INSERT INTO hotel_reservation_rooms (
      organization_id, reservation_id, room_type_id, rate_plan_id,
      check_in, check_out, guest_name, occupants, status
    ) VALUES (
      p_org, v_res_id, v_rt, v_rp, v_ci, v_co,
      NULLIF(room->>'guest_name', ''),
      GREATEST(1, COALESCE((room->>'occupants')::INT, 1)),
      v_status
    ) RETURNING id INTO v_rr_id;

    d := v_ci; i := 0;
    WHILE d < v_co LOOP
      INSERT INTO hotel_reservation_nights (organization_id, reservation_room_id, date, price_snapshot_cents)
        VALUES (p_org, v_rr_id, d, COALESCE((room->'night_prices'->>i)::INT, 0));
      d := d + 1; i := i + 1;
    END LOOP;
  END LOOP;

  -- 5) Folio.
  INSERT INTO hotel_folios (organization_id, reservation_id, status, total_cents)
    VALUES (p_org, v_res_id, 'open', v_total);

  RETURN jsonb_build_object('id', v_res_id, 'reference', v_ref);
END $$;
GRANT EXECUTE ON FUNCTION hotel_create_reservation(UUID, JSONB) TO authenticated;

COMMIT;

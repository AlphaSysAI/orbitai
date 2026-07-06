-- ============================================
-- 044 — Orbit Voice (assistant vocal IA) : socle transverse, Phase 0
--
-- Routage numéro de téléphone → organisation (+ vertical), journal d'appels,
-- et ajustement de la garde de hotel_create_reservation pour autoriser l'appel
-- MACHINE (service_role, via les endpoints « tools » appelés par la plateforme
-- vocale — auth.uid() est NULL dans ce cas). Les utilisateurs authentifiés
-- restent vérifiés par is_org_member.
-- ============================================

BEGIN;

-- ─── Routage numéro → organisation ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_numbers (
  phone_e164 TEXT PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vertical TEXT NOT NULL CHECK (vertical IN ('hotel', 'artisan')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voice_numbers_org ON voice_numbers(organization_id);

-- ─── Journal d'appels (transcription rattachable à une réservation) ──────────
CREATE TABLE IF NOT EXISTS voice_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vertical TEXT NOT NULL,
  caller_number TEXT,
  intent TEXT,
  transcript TEXT,
  reservation_id UUID REFERENCES hotel_reservations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voice_call_logs_org ON voice_call_logs(organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS set_voice_numbers_updated_at ON voice_numbers;
CREATE TRIGGER set_voice_numbers_updated_at BEFORE UPDATE ON voice_numbers
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─── RLS : lecture/écriture intra-org (config par l'org) ─────────────────────
ALTER TABLE voice_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS voice_numbers_member ON voice_numbers;
CREATE POLICY voice_numbers_member ON voice_numbers FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS voice_call_logs_member ON voice_call_logs;
CREATE POLICY voice_call_logs_member ON voice_call_logs FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

-- ─── Ajustement garde hotel_create_reservation (appel machine autorisé) ──────
-- Les endpoints « tools » vocaux appellent en service_role (auth.uid() NULL),
-- l'org étant résolue de façon sûre côté serveur depuis le numéro appelé.
-- On garde la vérification is_org_member pour les appels utilisateur.
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
  v_sold INT;
  v_cap INT;
BEGIN
  -- Utilisateur authentifié : doit être membre. Service_role (auth.uid NULL) : autorisé.
  IF auth.uid() IS NOT NULL AND NOT is_org_member(p_org) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_co <= v_ci THEN RAISE EXCEPTION 'invalid_dates'; END IF;

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

  INSERT INTO org_counters (organization_id, scope, year, last_value)
  VALUES (p_org, 'hotel_reservation', EXTRACT(YEAR FROM now())::INT, 1)
  ON CONFLICT (organization_id, scope, year)
  DO UPDATE SET last_value = org_counters.last_value + 1
  RETURNING last_value INTO v_seq;
  v_ref := 'R-' || EXTRACT(YEAR FROM now())::INT || '-' || lpad(v_seq::TEXT, 4, '0');

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

  INSERT INTO hotel_folios (organization_id, reservation_id, status, total_cents)
    VALUES (p_org, v_res_id, 'open', v_total);

  RETURN jsonb_build_object('id', v_res_id, 'reference', v_ref);
END $$;
GRANT EXECUTE ON FUNCTION hotel_create_reservation(UUID, JSONB) TO authenticated;

COMMIT;

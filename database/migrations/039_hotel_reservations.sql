-- ============================================
-- 039 — Orbit Hôtel : réservations (dossier, chambres, nuits, folio)
--
-- Phase 2, lot 3. Porté de 029_pms_reservations. Préfixe hotel_,
-- organization_id, RLS is_org_member.
-- Adaptations OrbitAll :
--   - contacts non porté → contact_id nullable SANS FK (lien futur) +
--     customer_name/customer_email dénormalisés sur le dossier.
--   - garde anti-surbooking (exclusion btree_gist) conservée : une chambre
--     physique assignée ne peut chevaucher deux dossiers actifs.
-- ============================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── Réservations (le dossier) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  contact_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  source hotel_room_source NOT NULL DEFAULT 'direct',
  status hotel_reservation_status NOT NULL DEFAULT 'option',
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  adults INT NOT NULL DEFAULT 1 CHECK (adults >= 0),
  children INT NOT NULL DEFAULT 0 CHECK (children >= 0),
  total_cents INT NOT NULL DEFAULT 0,
  paid_cents INT NOT NULL DEFAULT 0,
  balance_cents INT NOT NULL DEFAULT 0,
  deposit_cents INT NOT NULL DEFAULT 0,
  notes TEXT,
  idempotency_key TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hotel_reservations_dates_check CHECK (check_out > check_in),
  CONSTRAINT hotel_reservations_reference_unique UNIQUE (organization_id, reference),
  CONSTRAINT hotel_reservations_idempotency_unique UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_org_status ON hotel_reservations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_reservations_org_dates ON hotel_reservations(organization_id, check_in, check_out);

-- ─── Chambres du dossier ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_reservation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES hotel_reservations(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES hotel_room_types(id) ON DELETE RESTRICT,
  room_id UUID REFERENCES hotel_rooms(id) ON DELETE SET NULL,
  rate_plan_id UUID NOT NULL REFERENCES hotel_rate_plans(id) ON DELETE RESTRICT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guest_name TEXT,
  occupants INT NOT NULL DEFAULT 1 CHECK (occupants >= 0),
  status hotel_reservation_status NOT NULL DEFAULT 'option',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hotel_reservation_rooms_dates_check CHECK (check_out > check_in),
  CONSTRAINT hotel_reservation_rooms_no_overlap EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (room_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show'))
);
CREATE INDEX IF NOT EXISTS idx_hotel_reservation_rooms_res ON hotel_reservation_rooms(reservation_id);

-- ─── Nuits (snapshot de prix figé) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_reservation_nights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reservation_room_id UUID NOT NULL REFERENCES hotel_reservation_rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price_snapshot_cents INT NOT NULL CHECK (price_snapshot_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hotel_reservation_nights_unique UNIQUE (reservation_room_id, date)
);
CREATE INDEX IF NOT EXISTS idx_hotel_reservation_nights_org_date ON hotel_reservation_nights(organization_id, date);

-- ─── Folio ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_folios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES hotel_reservations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  total_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hotel_folios_res ON hotel_folios(reservation_id);

-- ─── updated_at ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS set_hotel_reservations_updated_at ON hotel_reservations;
CREATE TRIGGER set_hotel_reservations_updated_at BEFORE UPDATE ON hotel_reservations
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS set_hotel_reservation_rooms_updated_at ON hotel_reservation_rooms;
CREATE TRIGGER set_hotel_reservation_rooms_updated_at BEFORE UPDATE ON hotel_reservation_rooms
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS set_hotel_folios_updated_at ON hotel_folios;
CREATE TRIGGER set_hotel_folios_updated_at BEFORE UPDATE ON hotel_folios
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE hotel_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_reservation_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_reservation_nights ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_folios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_reservations_member ON hotel_reservations;
CREATE POLICY hotel_reservations_member ON hotel_reservations FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS hotel_reservation_rooms_member ON hotel_reservation_rooms;
CREATE POLICY hotel_reservation_rooms_member ON hotel_reservation_rooms FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS hotel_reservation_nights_member ON hotel_reservation_nights;
CREATE POLICY hotel_reservation_nights_member ON hotel_reservation_nights FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS hotel_folios_member ON hotel_folios;
CREATE POLICY hotel_folios_member ON hotel_folios FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

COMMIT;

-- ============================================
-- 037 — Orbit Hôtel : socle PMS (inventaire chambres)
--
-- Portage du PMS Hôtel (ex-projet standalone) sous OrbitAll — Phase 2, lot 1.
-- Périmètre de ce lot : enums PMS + types de chambres + chambres + calendrier
-- d'inventaire (garde anti-surbooking). Les réservations, tarifs, folios et
-- factures suivront dans des migrations ultérieures.
--
-- SÉCURITÉ : contrairement au projet source (service_role + filtrage manuel,
-- sans RLS), CHAQUE table porte organization_id + RLS is_org_member DÈS LE
-- DÉPART (défense en profondeur). Tables préfixées hotel_.
-- ============================================

BEGIN;

-- ─── Enums PMS (préfixe hotel_ : namespace) ──────────────────────────────────
DO $$ BEGIN
  CREATE TYPE hotel_housekeeping_status AS ENUM ('clean', 'dirty', 'inspected', 'out_of_order');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hotel_board AS ENUM ('RO', 'BB', 'HB', 'FB');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hotel_room_source AS ENUM ('direct', 'phone', 'walk_in', 'ota_other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hotel_reservation_status AS ENUM (
    'option', 'confirmed', 'checked_in', 'checked_out', 'no_show', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Types de chambres ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  capacity_adults INT NOT NULL DEFAULT 2 CHECK (capacity_adults >= 0),
  capacity_children INT NOT NULL DEFAULT 0 CHECK (capacity_children >= 0),
  base_occupancy INT NOT NULL DEFAULT 2 CHECK (base_occupancy >= 0),
  equipements JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_rate_cents INT NOT NULL DEFAULT 0 CHECK (default_rate_cents >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_hotel_room_types_org ON hotel_room_types(organization_id);

-- ─── Chambres physiques ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES hotel_room_types(id) ON DELETE RESTRICT,
  numero TEXT NOT NULL,
  etage TEXT,
  attributs JSONB NOT NULL DEFAULT '{}'::jsonb,
  housekeeping_status hotel_housekeeping_status NOT NULL DEFAULT 'clean',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_org ON hotel_rooms(organization_id);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_type ON hotel_rooms(room_type_id) WHERE is_active;

-- ─── Calendrier d'inventaire (garde anti-surbooking niveau type) ─────────────
-- L'UNIQUE (organization_id, room_type_id, date) est LOAD-BEARING (INSERT ON
-- CONFLICT DO NOTHING + SELECT FOR UPDATE). NE JAMAIS LE RETIRER.
CREATE TABLE IF NOT EXISTS hotel_inventory_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES hotel_room_types(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total INT NOT NULL DEFAULT 0 CHECK (total >= 0),
  sold INT NOT NULL DEFAULT 0 CHECK (sold >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, room_type_id, date)
);
CREATE INDEX IF NOT EXISTS idx_hotel_inventory_org_date
  ON hotel_inventory_calendar(organization_id, date);

-- ─── updated_at ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS set_hotel_room_types_updated_at ON hotel_room_types;
CREATE TRIGGER set_hotel_room_types_updated_at BEFORE UPDATE ON hotel_room_types
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS set_hotel_rooms_updated_at ON hotel_rooms;
CREATE TRIGGER set_hotel_rooms_updated_at BEFORE UPDATE ON hotel_rooms
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS set_hotel_inventory_updated_at ON hotel_inventory_calendar;
CREATE TRIGGER set_hotel_inventory_updated_at BEFORE UPDATE ON hotel_inventory_calendar
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─── RLS : accès réservé aux membres de l'organisation ───────────────────────
ALTER TABLE hotel_room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_inventory_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_room_types_member ON hotel_room_types;
CREATE POLICY hotel_room_types_member ON hotel_room_types FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS hotel_rooms_member ON hotel_rooms;
CREATE POLICY hotel_rooms_member ON hotel_rooms FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS hotel_inventory_member ON hotel_inventory_calendar;
CREATE POLICY hotel_inventory_member ON hotel_inventory_calendar FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

COMMIT;

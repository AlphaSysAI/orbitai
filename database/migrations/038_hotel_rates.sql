-- ============================================
-- 038 — Orbit Hôtel : tarifs (plans tarifaires + calendrier de prix)
--
-- Phase 2, lot 2. Porté de 028_pms_rates. Préfixe hotel_, organization_id,
-- RLS is_org_member (le source utilisait user_organisation_id() sans RLS
-- défensive systématique).
-- ============================================

BEGIN;

-- ─── Plans tarifaires ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  nom TEXT NOT NULL,
  room_type_id UUID REFERENCES hotel_room_types(id) ON DELETE CASCADE,
  board hotel_board NOT NULL DEFAULT 'RO',
  refundable BOOLEAN NOT NULL DEFAULT TRUE,
  cancellation_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_hotel_rate_plans_org ON hotel_rate_plans(organization_id);

-- ─── Calendrier de prix / restrictions par jour ──────────────────────────────
CREATE TABLE IF NOT EXISTS hotel_rate_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rate_plan_id UUID NOT NULL REFERENCES hotel_rate_plans(id) ON DELETE CASCADE,
  room_type_id UUID NOT NULL REFERENCES hotel_room_types(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  min_stay INT NOT NULL DEFAULT 1 CHECK (min_stay >= 1),
  max_stay INT CHECK (max_stay IS NULL OR max_stay >= min_stay),
  closed BOOLEAN NOT NULL DEFAULT FALSE,
  cta BOOLEAN NOT NULL DEFAULT FALSE,
  ctd BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hotel_rate_calendar_unique UNIQUE (rate_plan_id, room_type_id, date)
);
CREATE INDEX IF NOT EXISTS idx_hotel_rate_calendar_org_date ON hotel_rate_calendar(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_hotel_rate_calendar_lookup ON hotel_rate_calendar(rate_plan_id, room_type_id, date);

-- ─── updated_at ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS set_hotel_rate_plans_updated_at ON hotel_rate_plans;
CREATE TRIGGER set_hotel_rate_plans_updated_at BEFORE UPDATE ON hotel_rate_plans
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS set_hotel_rate_calendar_updated_at ON hotel_rate_calendar;
CREATE TRIGGER set_hotel_rate_calendar_updated_at BEFORE UPDATE ON hotel_rate_calendar
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE hotel_rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_rate_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_rate_plans_member ON hotel_rate_plans;
CREATE POLICY hotel_rate_plans_member ON hotel_rate_plans FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS hotel_rate_calendar_member ON hotel_rate_calendar;
CREATE POLICY hotel_rate_calendar_member ON hotel_rate_calendar FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

COMMIT;

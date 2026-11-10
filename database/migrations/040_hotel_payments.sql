-- ============================================
-- 040 — Orbit Hôtel : paiements (enregistrement comptable seul)
--
-- Phase 2, lot 5. Porté de 035_pms_payments SANS PSP/Stripe (décision : billing
-- différé, enregistrement seul). Préfixe hotel_, organization_id, RLS.
-- Les montants encaissés mettent à jour paid_cents / balance_cents du dossier
-- (recalculés côté action serveur). Pas d'encaissement carte réel.
-- ============================================

BEGIN;

DO $$ BEGIN
  CREATE TYPE hotel_payment_method AS ENUM ('cash', 'card', 'transfer', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE hotel_payment_kind AS ENUM ('deposit', 'balance', 'refund');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS hotel_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES hotel_reservations(id) ON DELETE CASCADE,
  folio_id UUID REFERENCES hotel_folios(id) ON DELETE SET NULL,
  method hotel_payment_method NOT NULL,
  kind hotel_payment_kind NOT NULL,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hotel_payments_reservation ON hotel_payments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_hotel_payments_org ON hotel_payments(organization_id);

ALTER TABLE hotel_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_payments_member ON hotel_payments;
CREATE POLICY hotel_payments_member ON hotel_payments FOR ALL
  USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));

COMMIT;

-- ============================================
-- 028 — RégiAire : réception BL par email entrant
-- ============================================
-- Ajoute email_slug sur les aires (adresse d'entrée unique par aire)
-- et assouplit deliveries pour les sources sans utilisateur authentifié.
-- ============================================

BEGIN;

-- 1. Slug email par aire (ex. "arzens-sud" → arzens-sud@regiaire.alphasys.tech)
ALTER TABLE aires
  ADD COLUMN IF NOT EXISTS email_slug TEXT;

-- Unicité globale sur le slug (non null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_aires_email_slug
  ON aires (email_slug)
  WHERE email_slug IS NOT NULL;

COMMENT ON COLUMN aires.email_slug IS
  'Identifiant court unique — partie locale de l''adresse email dédiée au dépôt de BL (ex. arzens-sud).';

-- 2. Assouplissement de deliveries pour les livraisons créées par email
--    (pas de session utilisateur, fournisseur potentiellement inconnu)
ALTER TABLE deliveries
  ALTER COLUMN supplier_id DROP NOT NULL;

ALTER TABLE deliveries
  ALTER COLUMN created_by DROP NOT NULL;

-- 3. Traçabilité source
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'email'));

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS inbound_sender_email TEXT;

COMMENT ON COLUMN deliveries.source IS
  'Origine de la livraison : manual (saisie UI) ou email (webhook inbound).';

COMMENT ON COLUMN deliveries.inbound_sender_email IS
  'Email expéditeur du BL reçu par webhook (source = email uniquement).';

COMMIT;

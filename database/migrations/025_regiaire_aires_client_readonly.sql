-- ============================================
-- 025 — RégiAire : aires en lecture seule côté client
-- Création / modification / suppression réservées à l'admin OrbitAI (service_role).
-- ============================================

BEGIN;

DROP POLICY IF EXISTS "regiaire_aires_insert" ON aires;
DROP POLICY IF EXISTS "regiaire_aires_update" ON aires;
DROP POLICY IF EXISTS "regiaire_aires_delete" ON aires;

COMMENT ON TABLE aires IS
  'Aires / stations RégiAire. Lecture org ; écriture admin OrbitAI uniquement.';

COMMIT;

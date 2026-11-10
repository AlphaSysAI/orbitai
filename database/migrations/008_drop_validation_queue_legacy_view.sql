-- ============================================
-- 008 — Phase D.1 : suppression VIEW legacy validation_queue
-- ai_review_queue reste la table canonique (007).
-- Idempotent.
-- ============================================

BEGIN;

DROP VIEW IF EXISTS validation_queue CASCADE;

COMMENT ON TABLE ai_review_queue IS
  'AI Review Engine — file de révision humaine (1 review = 1 artefact). Table canonique.';

COMMIT;

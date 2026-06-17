-- ============================================
-- 011 — Correctif alertes Supabase SECURITY DEFINER (vues)
--
-- 1. validation_queue : vue legacy OpenClaw (007) — à supprimer (Phase D.1 / 008).
-- 2. v_user_action_success_count : recréer avec security_invoker = true
--    pour appliquer le RLS de l'utilisateur qui interroge la vue.
--
-- Idempotent. Exécuter dans Supabase SQL Editor.
-- ============================================

BEGIN;

-- ── 1. Suppression vue legacy validation_queue ─────────────────────────────
DROP VIEW IF EXISTS validation_queue CASCADE;

-- ── 2. Vue auto-pilot : SECURITY INVOKER ───────────────────────────────────
DROP VIEW IF EXISTS v_user_action_success_count;

CREATE VIEW v_user_action_success_count
WITH (security_invoker = true)
AS
SELECT
  user_id,
  action AS action_type,
  COUNT(*)::integer AS success_count
FROM agent_actions_index
GROUP BY user_id, action;

COMMENT ON VIEW v_user_action_success_count IS
  'Nombre de succès (agent_actions_index) par user_id et action_type. security_invoker — RLS de l''appelant.';

COMMIT;

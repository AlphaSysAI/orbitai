-- ============================================
-- ORBITAI - SCRIPT DE RÉINITIALISATION COMPLÈTE
-- ============================================
-- ⚠️ ATTENTION : Ce script supprime TOUTES les tables et données OrbitAI
-- Il ne touche PAS aux tables système Supabase (auth.users, etc.)
-- Exécutez ce script AVANT init.sql pour repartir de zéro
-- ============================================

-- Désactiver temporairement les contraintes de foreign key pour faciliter les suppressions
SET session_replication_role = 'replica';

-- Supprimer les triggers d'abord
DROP TRIGGER IF EXISTS trigger_update_preferences_on_feedback ON message_feedback;

-- Supprimer les fonctions et vues OpenClaw
DROP VIEW IF EXISTS v_user_action_success_count CASCADE;
DROP FUNCTION IF EXISTS get_success_count_by_action(UUID) CASCADE;
DROP FUNCTION IF EXISTS org_has_module(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_my_enabled_modules() CASCADE;

-- Supprimer les fonctions (CASCADE supprime aussi les dépendances)
DROP FUNCTION IF EXISTS update_user_preferences_from_feedback() CASCADE;

-- Supprimer les politiques RLS (automatiquement supprimées avec les tables, mais on peut être explicite)
-- Pas nécessaire car CASCADE les supprime, mais c'est plus propre

-- Supprimer les tables dans l'ordre (en respectant les dépendances)
-- Tables dépendantes en premier (avec CASCADE pour supprimer aussi les foreign keys)

-- Multi-tenant (009)
DROP TABLE IF EXISTS organization_modules CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- OpenClaw (auto-pilot dépend de agent_actions_index via la vue)
DROP TABLE IF EXISTS automation_policies CASCADE;
DROP TABLE IF EXISTS skill_manifests CASCADE;
DROP TABLE IF EXISTS inbox_validation CASCADE;
DROP TABLE IF EXISTS inbox_reports CASCADE;
DROP TABLE IF EXISTS inbox_agent_logs CASCADE;
DROP TABLE IF EXISTS agent_logs CASCADE;
DROP TABLE IF EXISTS daily_reports CASCADE;
DROP TABLE IF EXISTS agent_actions_index CASCADE;
DROP VIEW IF EXISTS validation_queue CASCADE;
DROP TABLE IF EXISTS ai_review_queue CASCADE;

-- Pilier 5: Synthèse Intelligente Client (doivent être supprimées en premier à cause des foreign keys)
DROP TABLE IF EXISTS marketing_analysis CASCADE;
DROP TABLE IF EXISTS client_feedback_items CASCADE;
DROP TABLE IF EXISTS client_feedback_sources CASCADE;

-- Autres tables
DROP TABLE IF EXISTS message_feedback CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS automation_executions CASCADE;
DROP TABLE IF EXISTS automations CASCADE;
DROP TABLE IF EXISTS gray_tasks CASCADE;
DROP TABLE IF EXISTS user_actions CASCADE;
DROP TABLE IF EXISTS decision_simulations CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS threads CASCADE;
DROP TABLE IF EXISTS documents CASCADE;

-- Réactiver les contraintes
SET session_replication_role = 'origin';

-- Afficher un message de confirmation
DO $$
DECLARE
  remaining_tables INTEGER;
BEGIN
  -- Compter les tables OrbitAI restantes (ne devrait être que 0)
  SELECT COUNT(*) INTO remaining_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'documents', 'threads', 'messages', 'decision_simulations',
    'gray_tasks', 'automations', 'automation_executions', 'user_actions',
    'user_preferences', 'message_feedback',
    'client_feedback_sources', 'client_feedback_items', 'marketing_analysis',
    'ai_review_queue', 'agent_actions_index', 'daily_reports', 'agent_logs',
    'inbox_agent_logs', 'inbox_reports', 'inbox_validation', 'skill_manifests',
    'automation_policies', 'organization_modules', 'organization_members', 'organizations'
  );
  
  IF remaining_tables = 0 THEN
    RAISE NOTICE '✅ Toutes les tables OrbitAI ont été supprimées avec succès.';
    RAISE NOTICE '📝 Vous pouvez maintenant exécuter init.sql pour tout recréer.';
  ELSE
    RAISE WARNING '⚠️ Il reste % table(s) OrbitAI. Vérifiez manuellement.', remaining_tables;
  END IF;
END $$;


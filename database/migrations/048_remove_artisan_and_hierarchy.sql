-- Migration 048 — Simplification : suppression d'Orbit Artisan et de la hiérarchie multi-niveaux
--
-- Retire le vertical Artisan et toute la hiérarchie d'enseigne (secteurs,
-- directeurs régionaux, chefs de secteur, gérants). Aplatit le modèle de rôles
-- sur owner / admin / member / employe.
--
-- À appliquer manuellement dans le SQL Editor Supabase (cf. CLAUDE.md).

BEGIN;

-- ─── Orbit Artisan ──────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.artisan_invoice_lines   CASCADE;
DROP TABLE IF EXISTS public.artisan_invoices        CASCADE;
DROP TABLE IF EXISTS public.artisan_quote_materials CASCADE;
DROP TABLE IF EXISTS public.artisan_quote_services  CASCADE;
DROP TABLE IF EXISTS public.artisan_quotes          CASCADE;
DROP TABLE IF EXISTS public.artisan_contacts        CASCADE;
DROP TABLE IF EXISTS public.artisan_services        CASCADE;
DROP TABLE IF EXISTS public.artisan_profiles        CASCADE;

-- Désactive le module artisan éventuellement activé pour des organisations.
DELETE FROM public.organization_modules WHERE module_name = 'artisan_core';

-- ─── Hiérarchie multi-niveaux ───────────────────────────────────────────────
DROP TABLE IF EXISTS public.secteur_verdict_runs   CASCADE;
DROP TABLE IF EXISTS public.secteur_overview_cache CASCADE;
DROP TABLE IF EXISTS public.gerant_aires           CASCADE;
DROP TABLE IF EXISTS public.org_hierarchy_links     CASCADE;

-- La colonne aires.secteur_id référence secteurs : on la retire avant le DROP.
ALTER TABLE public.aires DROP COLUMN IF EXISTS secteur_id;
DROP TABLE IF EXISTS public.secteurs CASCADE;

-- ─── Aplatissement des rôles ────────────────────────────────────────────────
-- Les anciens rôles de management deviennent 'admin' (évite tout verrouillage
-- d'accès). Les employés d'aire restent 'employe'.
UPDATE public.organization_members
   SET role = 'admin'
 WHERE role IN ('direction_france', 'directeur_region', 'chef_secteur', 'gerant');

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'employe'));

COMMIT;

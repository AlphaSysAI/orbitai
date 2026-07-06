-- ============================================
-- 033 — Durcissement RLS : aires + secteur_verdict_runs
--
-- Audit de sécurité 2026-06-26 :
--   - Aires : INSERT/UPDATE/DELETE limités aux admins org (is_org_admin)
--   - secteur_verdict_runs INSERT : limité au chef du secteur + admins org
-- ============================================

BEGIN;

-- ─── Aires : écriture réservée aux admins ────────────────────────────────────
-- Avant : is_org_member (tout membre org pouvait créer/modifier/supprimer des aires)
-- Après : is_org_admin  (owner, admin, direction_france uniquement)

DROP POLICY IF EXISTS "regiaire_aires_insert" ON aires;
CREATE POLICY "regiaire_aires_insert"
  ON aires FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

DROP POLICY IF EXISTS "regiaire_aires_update" ON aires;
CREATE POLICY "regiaire_aires_update"
  ON aires FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

DROP POLICY IF EXISTS "regiaire_aires_delete" ON aires;
CREATE POLICY "regiaire_aires_delete"
  ON aires FOR DELETE
  USING (is_org_admin(organization_id));

-- La lecture reste accessible à tous les membres org (is_org_member).
-- regiaire_aires_select est inchangée.

-- ─── secteur_verdict_runs INSERT : chef du secteur ou admin ──────────────────
-- Avant : is_org_member (tout membre org pouvait insérer un verdict pour n'importe quel secteur)
-- Après : chef propriétaire du secteur OU admin org

DROP POLICY IF EXISTS "secteur_verdict_insert" ON secteur_verdict_runs;
CREATE POLICY "secteur_verdict_insert"
  ON secteur_verdict_runs FOR INSERT
  WITH CHECK (
    is_org_admin(organization_id)
    OR EXISTS (
      SELECT 1 FROM secteurs s
      WHERE s.id = secteur_verdict_runs.secteur_id
        AND s.chef_user_id = auth.uid()
    )
  );

-- UPDATE : même restriction (upsert utilisé pour la régénération)
DROP POLICY IF EXISTS "secteur_verdict_update" ON secteur_verdict_runs;
CREATE POLICY "secteur_verdict_update"
  ON secteur_verdict_runs FOR UPDATE
  USING (
    is_org_admin(organization_id)
    OR EXISTS (
      SELECT 1 FROM secteurs s
      WHERE s.id = secteur_verdict_runs.secteur_id
        AND s.chef_user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_org_admin(organization_id)
    OR EXISTS (
      SELECT 1 FROM secteurs s
      WHERE s.id = secteur_verdict_runs.secteur_id
        AND s.chef_user_id = auth.uid()
    )
  );

COMMIT;

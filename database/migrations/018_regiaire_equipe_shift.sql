-- ============================================
-- 018 — RégiAire Équipe : passation de quart
-- RLS is_org_member (USING + WITH CHECK).
-- ============================================

BEGIN;

DO $$
BEGIN
  CREATE TYPE shift_period AS ENUM ('matin', 'apres_midi', 'nuit');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS shift_task_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  shifts shift_period[] NOT NULL,
  position INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_task_defs_org ON shift_task_defs(organization_id);
CREATE INDEX IF NOT EXISTS idx_shift_task_defs_org_active ON shift_task_defs(organization_id, active);

CREATE TABLE IF NOT EXISTS shift_task_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shift shift_period NOT NULL,
  service_date DATE NOT NULL,
  task_def_id UUID NOT NULL REFERENCES shift_task_defs(id) ON DELETE CASCADE,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  UNIQUE (organization_id, shift, service_date, task_def_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_task_checks_lookup
  ON shift_task_checks(organization_id, shift, service_date);

CREATE TABLE IF NOT EXISTS shift_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shift shift_period NOT NULL,
  service_date DATE NOT NULL,
  closed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_tasks INT NOT NULL,
  checked_tasks INT NOT NULL,
  completion_pct NUMERIC(5, 2) NOT NULL,
  missing_labels TEXT[] NOT NULL DEFAULT '{}',
  note TEXT,
  UNIQUE (organization_id, shift, service_date)
);

CREATE INDEX IF NOT EXISTS idx_shift_closures_org_date
  ON shift_closures(organization_id, service_date DESC);

ALTER TABLE shift_task_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_task_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regiaire_shift_task_defs_select" ON shift_task_defs;
CREATE POLICY "regiaire_shift_task_defs_select"
  ON shift_task_defs FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_defs_insert" ON shift_task_defs;
CREATE POLICY "regiaire_shift_task_defs_insert"
  ON shift_task_defs FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_defs_update" ON shift_task_defs;
CREATE POLICY "regiaire_shift_task_defs_update"
  ON shift_task_defs FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_defs_delete" ON shift_task_defs;
CREATE POLICY "regiaire_shift_task_defs_delete"
  ON shift_task_defs FOR DELETE
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_select" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_select"
  ON shift_task_checks FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_insert" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_insert"
  ON shift_task_checks FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_update" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_update"
  ON shift_task_checks FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_delete" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_delete"
  ON shift_task_checks FOR DELETE
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_select" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_select"
  ON shift_closures FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_insert" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_insert"
  ON shift_closures FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_update" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_update"
  ON shift_closures FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_delete" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_delete"
  ON shift_closures FOR DELETE
  USING (is_org_member(organization_id));

COMMENT ON TABLE shift_task_defs IS 'Définitions de tâches de passation de quart (par org).';
COMMENT ON TABLE shift_task_checks IS 'État coché des tâches pour un quart et une date de service.';
COMMENT ON TABLE shift_closures IS 'Clôture de quart — verrouille les modifications (terminal).';

COMMIT;

-- ============================================
-- 021 — Verdict : un run par org et date de service (cache)
-- ============================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_verdict_runs_org_run_date_unique
  ON verdict_runs(organization_id, run_date);

COMMIT;

-- ============================================
-- 022 — RégiAire multi-aires (étape 1/2) : modèle + re-scope aire_id
-- Absorbe regiaire_station_settings → aires. RLS is_aire_member sur tables aire-level.
-- organization_id conservé (drop prévu étape 3).
-- ============================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Table aires (+ is_aire_member)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS aires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat NUMERIC(9, 6) NOT NULL,
  lon NUMERIC(9, 6) NOT NULL,
  city TEXT,
  school_zone TEXT NOT NULL CHECK (school_zone IN ('A', 'B', 'C')),
  order_days INT[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aires_organization_id ON aires(organization_id);
CREATE INDEX IF NOT EXISTS idx_aires_org_created ON aires(organization_id, created_at);

COMMENT ON TABLE aires IS
  'Aires / stations RégiAire (remplace regiaire_station_settings).';

CREATE OR REPLACE FUNCTION is_aire_member(p_aire_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM aires a
    INNER JOIN organization_members om
      ON om.organization_id = a.organization_id
     AND om.user_id = auth.uid()
    WHERE a.id = p_aire_id
  );
$$;

COMMENT ON FUNCTION is_aire_member(UUID) IS
  'True si l''utilisateur courant est membre de l''org propriétaire de l''aire.';

CREATE OR REPLACE FUNCTION regiaire_default_aire_id(p_organization_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id
  FROM aires a
  WHERE a.organization_id = p_organization_id
  ORDER BY a.created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION regiaire_default_aire_id(UUID) IS
  'Aire par défaut d''une org (la plus ancienne). Fallback UI legacy.';

-- ---------------------------------------------------------------------------
-- Backfill aires depuis station_settings (+ orgs RégiAire sans settings)
-- ---------------------------------------------------------------------------

INSERT INTO aires (organization_id, name, lat, lon, city, school_zone, order_days, created_at)
SELECT
  rss.organization_id,
  COALESCE(NULLIF(TRIM(rss.city), ''), 'Aire principale'),
  rss.lat,
  rss.lon,
  rss.city,
  rss.school_zone,
  rss.order_days,
  COALESCE(rss.updated_at, NOW())
FROM regiaire_station_settings rss
WHERE NOT EXISTS (
  SELECT 1 FROM aires a WHERE a.organization_id = rss.organization_id
);

INSERT INTO aires (organization_id, name, lat, lon, city, school_zone, order_days)
SELECT DISTINCT
  om.organization_id,
  'Aire principale',
  43.212800,
  2.353700,
  NULL,
  'C',
  ARRAY[1, 3, 5]
FROM organization_modules om
WHERE om.module_name = 'regiaire_core'
  AND om.is_enabled = true
  AND NOT EXISTS (
    SELECT 1 FROM aires a WHERE a.organization_id = om.organization_id
  );

INSERT INTO aires (organization_id, name, lat, lon, city, school_zone, order_days)
SELECT DISTINCT
  d.organization_id,
  'Aire principale',
  43.212800,
  2.353700,
  NULL,
  'C',
  ARRAY[1, 3, 5]
FROM deliveries d
WHERE NOT EXISTS (
  SELECT 1 FROM aires a WHERE a.organization_id = d.organization_id
);

COMMENT ON TABLE regiaire_station_settings IS
  'DEPRECATED — absorbé par aires (étape multi-aires). Ne plus utiliser.';

-- ---------------------------------------------------------------------------
-- aire_id sur tables aire-level
-- ---------------------------------------------------------------------------

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS aire_id UUID REFERENCES aires(id) ON DELETE RESTRICT;
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS aire_id UUID REFERENCES aires(id) ON DELETE RESTRICT;
ALTER TABLE sales_history ADD COLUMN IF NOT EXISTS aire_id UUID REFERENCES aires(id) ON DELETE CASCADE;
ALTER TABLE traffic_signals ADD COLUMN IF NOT EXISTS aire_id UUID REFERENCES aires(id) ON DELETE CASCADE;
ALTER TABLE verdict_runs ADD COLUMN IF NOT EXISTS aire_id UUID REFERENCES aires(id) ON DELETE CASCADE;
ALTER TABLE shift_task_checks ADD COLUMN IF NOT EXISTS aire_id UUID REFERENCES aires(id) ON DELETE CASCADE;
ALTER TABLE shift_closures ADD COLUMN IF NOT EXISTS aire_id UUID REFERENCES aires(id) ON DELETE CASCADE;

UPDATE deliveries d
SET aire_id = regiaire_default_aire_id(d.organization_id)
WHERE d.aire_id IS NULL;

UPDATE stock_batches sb
SET aire_id = COALESCE(
  (SELECT d.aire_id FROM deliveries d WHERE d.id = sb.delivery_id),
  regiaire_default_aire_id(sb.organization_id)
)
WHERE sb.aire_id IS NULL;

UPDATE sales_history sh
SET aire_id = regiaire_default_aire_id(sh.organization_id)
WHERE sh.aire_id IS NULL;

UPDATE traffic_signals ts
SET aire_id = regiaire_default_aire_id(ts.organization_id)
WHERE ts.aire_id IS NULL;

UPDATE verdict_runs vr
SET aire_id = regiaire_default_aire_id(vr.organization_id)
WHERE vr.aire_id IS NULL;

UPDATE shift_task_checks stc
SET aire_id = regiaire_default_aire_id(stc.organization_id)
WHERE stc.aire_id IS NULL;

UPDATE shift_closures sc
SET aire_id = regiaire_default_aire_id(sc.organization_id)
WHERE sc.aire_id IS NULL;

ALTER TABLE deliveries ALTER COLUMN aire_id SET NOT NULL;
ALTER TABLE stock_batches ALTER COLUMN aire_id SET NOT NULL;
ALTER TABLE sales_history ALTER COLUMN aire_id SET NOT NULL;
ALTER TABLE traffic_signals ALTER COLUMN aire_id SET NOT NULL;
ALTER TABLE verdict_runs ALTER COLUMN aire_id SET NOT NULL;
ALTER TABLE shift_task_checks ALTER COLUMN aire_id SET NOT NULL;
ALTER TABLE shift_closures ALTER COLUMN aire_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_aire_id ON deliveries(aire_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_aire_id ON stock_batches(aire_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_aire_date ON sales_history(aire_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_traffic_signals_aire_date ON traffic_signals(aire_id, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_verdict_runs_aire_date ON verdict_runs(aire_id, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_shift_task_checks_aire ON shift_task_checks(aire_id, shift, service_date);
CREATE INDEX IF NOT EXISTS idx_shift_closures_aire_date ON shift_closures(aire_id, service_date DESC);

-- UNIQUE adaptés
ALTER TABLE traffic_signals DROP CONSTRAINT IF EXISTS traffic_signals_organization_id_signal_date_key;
DROP INDEX IF EXISTS idx_verdict_runs_org_run_date_unique;
ALTER TABLE shift_task_checks DROP CONSTRAINT IF EXISTS shift_task_checks_organization_id_shift_service_date_task_def_id_key;
ALTER TABLE shift_closures DROP CONSTRAINT IF EXISTS shift_closures_organization_id_shift_service_date_key;

ALTER TABLE traffic_signals
  ADD CONSTRAINT traffic_signals_aire_id_signal_date_key UNIQUE (aire_id, signal_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_verdict_runs_aire_run_date_unique
  ON verdict_runs(aire_id, run_date);

ALTER TABLE shift_task_checks
  ADD CONSTRAINT shift_task_checks_aire_shift_date_task_key
  UNIQUE (aire_id, shift, service_date, task_def_id);

ALTER TABLE shift_closures
  ADD CONSTRAINT shift_closures_aire_shift_date_key
  UNIQUE (aire_id, shift, service_date);

-- Trigger : inserts client legacy sans aire_id (ex. wizard réception)
CREATE OR REPLACE FUNCTION trg_regiaire_set_default_aire_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.aire_id IS NULL AND NEW.organization_id IS NOT NULL THEN
    NEW.aire_id := regiaire_default_aire_id(NEW.organization_id);
  END IF;
  IF NEW.aire_id IS NULL THEN
    RAISE EXCEPTION 'regiaire_no_aire_for_org';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deliveries_set_default_aire_id ON deliveries;
CREATE TRIGGER deliveries_set_default_aire_id
  BEFORE INSERT ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION trg_regiaire_set_default_aire_id();

-- ---------------------------------------------------------------------------
-- RPC finalisation — stock_batches avec aire_id
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION regiaire_finalize_delivery(p_delivery_id uuid)
RETURNS TABLE (outcome text, batches_created integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status delivery_status;
  v_org_id uuid;
  v_aire_id uuid;
  v_has_discrepancy boolean := false;
  v_batches integer := 0;
  v_line record;
BEGIN
  SELECT d.status, d.organization_id, d.aire_id
    INTO v_status, v_org_id, v_aire_id
  FROM deliveries d
  WHERE d.id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'delivery_not_found';
  END IF;

  IF v_status <> 'scanning' THEN
    outcome := 'already_finalized';
    batches_created := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM delivery_lines dl WHERE dl.delivery_id = p_delivery_id
  ) THEN
    RAISE EXCEPTION 'no_lines';
  END IF;

  FOR v_line IN
    SELECT dl.expected_qty, dl.scanned_qty, dl.product_id
    FROM delivery_lines dl
    WHERE dl.delivery_id = p_delivery_id
  LOOP
    IF v_line.scanned_qty > 0 AND v_line.product_id IS NULL THEN
      v_has_discrepancy := true;
    ELSIF v_line.expected_qty = 0 AND v_line.scanned_qty > 0 THEN
      v_has_discrepancy := true;
    ELSIF v_line.expected_qty > 0 AND v_line.scanned_qty IS DISTINCT FROM v_line.expected_qty THEN
      v_has_discrepancy := true;
    END IF;
  END LOOP;

  INSERT INTO stock_batches (organization_id, aire_id, product_id, quantity, dlc, delivery_id)
  SELECT v_org_id, v_aire_id, dl.product_id, dl.scanned_qty, dl.dlc, p_delivery_id
  FROM delivery_lines dl
  WHERE dl.delivery_id = p_delivery_id
    AND dl.scanned_qty > 0
    AND dl.product_id IS NOT NULL;

  GET DIAGNOSTICS v_batches = ROW_COUNT;

  IF v_batches = 0 THEN
    RAISE EXCEPTION 'no_scanned_stock';
  END IF;

  IF v_has_discrepancy THEN
    UPDATE deliveries
    SET status = 'discrepancy',
        completed_at = NOW()
    WHERE id = p_delivery_id;

    outcome := 'discrepancy';
  ELSE
    UPDATE deliveries
    SET status = 'completed',
        completed_at = NOW()
    WHERE id = p_delivery_id;

    outcome := 'completed';
  END IF;

  batches_created := v_batches;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS aires
-- ---------------------------------------------------------------------------

ALTER TABLE aires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regiaire_aires_select" ON aires;
CREATE POLICY "regiaire_aires_select"
  ON aires FOR SELECT
  USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_aires_insert" ON aires;
CREATE POLICY "regiaire_aires_insert"
  ON aires FOR INSERT
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_aires_update" ON aires;
CREATE POLICY "regiaire_aires_update"
  ON aires FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

DROP POLICY IF EXISTS "regiaire_aires_delete" ON aires;
CREATE POLICY "regiaire_aires_delete"
  ON aires FOR DELETE
  USING (is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- RLS aire-level → is_aire_member(aire_id)
-- ---------------------------------------------------------------------------

-- deliveries
DROP POLICY IF EXISTS "regiaire_deliveries_select" ON deliveries;
CREATE POLICY "regiaire_deliveries_select"
  ON deliveries FOR SELECT
  USING (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_deliveries_insert" ON deliveries;
CREATE POLICY "regiaire_deliveries_insert"
  ON deliveries FOR INSERT
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_deliveries_update" ON deliveries;
CREATE POLICY "regiaire_deliveries_update"
  ON deliveries FOR UPDATE
  USING (is_aire_member(aire_id))
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_deliveries_delete" ON deliveries;
CREATE POLICY "regiaire_deliveries_delete"
  ON deliveries FOR DELETE
  USING (is_aire_member(aire_id));

-- delivery_lines (via delivery.aire_id)
DROP POLICY IF EXISTS "regiaire_delivery_lines_select" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_select"
  ON delivery_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_aire_member(d.aire_id)
    )
  );

DROP POLICY IF EXISTS "regiaire_delivery_lines_insert" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_insert"
  ON delivery_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_aire_member(d.aire_id)
    )
  );

DROP POLICY IF EXISTS "regiaire_delivery_lines_update" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_update"
  ON delivery_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_aire_member(d.aire_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_aire_member(d.aire_id)
    )
  );

DROP POLICY IF EXISTS "regiaire_delivery_lines_delete" ON delivery_lines;
CREATE POLICY "regiaire_delivery_lines_delete"
  ON delivery_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_lines.delivery_id
        AND is_aire_member(d.aire_id)
    )
  );

-- stock_batches
DROP POLICY IF EXISTS "regiaire_stock_batches_select" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_select"
  ON stock_batches FOR SELECT
  USING (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_stock_batches_insert" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_insert"
  ON stock_batches FOR INSERT
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_stock_batches_update" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_update"
  ON stock_batches FOR UPDATE
  USING (is_aire_member(aire_id))
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_stock_batches_delete" ON stock_batches;
CREATE POLICY "regiaire_stock_batches_delete"
  ON stock_batches FOR DELETE
  USING (is_aire_member(aire_id));

-- sales_history
DROP POLICY IF EXISTS "regiaire_sales_history_select" ON sales_history;
CREATE POLICY "regiaire_sales_history_select"
  ON sales_history FOR SELECT
  USING (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_sales_history_insert" ON sales_history;
CREATE POLICY "regiaire_sales_history_insert"
  ON sales_history FOR INSERT
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_sales_history_update" ON sales_history;
CREATE POLICY "regiaire_sales_history_update"
  ON sales_history FOR UPDATE
  USING (is_aire_member(aire_id))
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_sales_history_delete" ON sales_history;
CREATE POLICY "regiaire_sales_history_delete"
  ON sales_history FOR DELETE
  USING (is_aire_member(aire_id));

-- traffic_signals
DROP POLICY IF EXISTS "regiaire_traffic_signals_select" ON traffic_signals;
CREATE POLICY "regiaire_traffic_signals_select"
  ON traffic_signals FOR SELECT
  USING (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_traffic_signals_insert" ON traffic_signals;
CREATE POLICY "regiaire_traffic_signals_insert"
  ON traffic_signals FOR INSERT
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_traffic_signals_update" ON traffic_signals;
CREATE POLICY "regiaire_traffic_signals_update"
  ON traffic_signals FOR UPDATE
  USING (is_aire_member(aire_id))
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_traffic_signals_delete" ON traffic_signals;
CREATE POLICY "regiaire_traffic_signals_delete"
  ON traffic_signals FOR DELETE
  USING (is_aire_member(aire_id));

-- verdict_runs
DROP POLICY IF EXISTS "regiaire_verdict_runs_select" ON verdict_runs;
CREATE POLICY "regiaire_verdict_runs_select"
  ON verdict_runs FOR SELECT
  USING (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_verdict_runs_insert" ON verdict_runs;
CREATE POLICY "regiaire_verdict_runs_insert"
  ON verdict_runs FOR INSERT
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_verdict_runs_update" ON verdict_runs;
CREATE POLICY "regiaire_verdict_runs_update"
  ON verdict_runs FOR UPDATE
  USING (is_aire_member(aire_id))
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_verdict_runs_delete" ON verdict_runs;
CREATE POLICY "regiaire_verdict_runs_delete"
  ON verdict_runs FOR DELETE
  USING (is_aire_member(aire_id));

-- shift_task_checks
DROP POLICY IF EXISTS "regiaire_shift_task_checks_select" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_select"
  ON shift_task_checks FOR SELECT
  USING (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_insert" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_insert"
  ON shift_task_checks FOR INSERT
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_update" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_update"
  ON shift_task_checks FOR UPDATE
  USING (is_aire_member(aire_id))
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_shift_task_checks_delete" ON shift_task_checks;
CREATE POLICY "regiaire_shift_task_checks_delete"
  ON shift_task_checks FOR DELETE
  USING (is_aire_member(aire_id));

-- shift_closures
DROP POLICY IF EXISTS "regiaire_shift_closures_select" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_select"
  ON shift_closures FOR SELECT
  USING (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_insert" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_insert"
  ON shift_closures FOR INSERT
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_update" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_update"
  ON shift_closures FOR UPDATE
  USING (is_aire_member(aire_id))
  WITH CHECK (is_aire_member(aire_id));

DROP POLICY IF EXISTS "regiaire_shift_closures_delete" ON shift_closures;
CREATE POLICY "regiaire_shift_closures_delete"
  ON shift_closures FOR DELETE
  USING (is_aire_member(aire_id));

COMMIT;

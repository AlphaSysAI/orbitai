-- ============================================
-- 007 — AI Review Engine : validation_queue → ai_review_queue
-- Idempotent autant que possible
-- ============================================

BEGIN;

-- ── 1. Renommer table ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'validation_queue'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_review_queue'
  ) THEN
    ALTER TABLE validation_queue RENAME TO ai_review_queue;
  END IF;
END $$;

-- ── 2. Renommer colonnes existantes ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_review_queue' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE ai_review_queue RENAME COLUMN event_id TO review_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_review_queue' AND column_name = 'action'
  ) THEN
    ALTER TABLE ai_review_queue RENAME COLUMN action TO review_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_review_queue' AND column_name = 'payload'
  ) THEN
    ALTER TABLE ai_review_queue RENAME COLUMN payload TO proposed_payload;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_review_queue' AND column_name = 'rationale'
  ) THEN
    ALTER TABLE ai_review_queue RENAME COLUMN rationale TO summary;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_review_queue' AND column_name = 'executed_at'
  ) THEN
    ALTER TABLE ai_review_queue RENAME COLUMN executed_at TO published_at;
  END IF;
END $$;

-- ── 3. Nouvelles colonnes ─────────────────────────────────────────
ALTER TABLE ai_review_queue
  ADD COLUMN IF NOT EXISTS subject_type TEXT,
  ADD COLUMN IF NOT EXISTS subject_id TEXT,
  ADD COLUMN IF NOT EXISTS source_module TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 4. Backfill métadonnées legacy (colonnes encore présentes) ────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_review_queue' AND column_name = 'human_input_required'
  ) THEN
    UPDATE ai_review_queue
    SET review_metadata = review_metadata || jsonb_build_object(
      'human_input_required', human_input_required
    )
    WHERE human_input_required IS NOT NULL
      AND NOT (review_metadata ? 'human_input_required');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_review_queue' AND column_name = 'raw_log_line'
  ) THEN
    UPDATE ai_review_queue
    SET review_metadata = review_metadata || jsonb_build_object(
      'raw_log_line', raw_log_line
    )
    WHERE raw_log_line IS NOT NULL
      AND NOT (review_metadata ? 'raw_log_line');
  END IF;
END $$;

-- ── 5. Backfill review_type + original_action ─────────────────────
UPDATE ai_review_queue
SET
  review_metadata = CASE
    WHEN review_type NOT IN (
      'knowledge_concept', 'knowledge_procedure', 'knowledge_role',
      'knowledge_faq', 'document_summary', 'learning_path', 'quiz',
      'expert_pattern', 'automation_suggestion', 'legacy_action'
    )
    THEN review_metadata || jsonb_build_object('original_action', review_type)
    ELSE review_metadata
  END,
  review_type = CASE
    WHEN review_type IN (
      'knowledge_concept', 'knowledge_procedure', 'knowledge_role',
      'knowledge_faq', 'document_summary', 'learning_path', 'quiz',
      'expert_pattern', 'automation_suggestion', 'legacy_action'
    ) THEN review_type
    ELSE 'legacy_action'
  END,
  title = CASE
    WHEN COALESCE(title, '') = '' THEN
      CASE
        WHEN review_type IN (
          'knowledge_concept', 'knowledge_procedure', 'knowledge_role',
          'knowledge_faq', 'document_summary', 'learning_path', 'quiz',
          'expert_pattern', 'automation_suggestion', 'legacy_action'
        ) THEN review_type
        ELSE COALESCE(review_metadata->>'original_action', 'legacy_action')
      END
    ELSE title
  END,
  source_module = COALESCE(source_module, 'legacy_openclaw')
WHERE TRUE;

-- Re-backfill title pour lignes déjà mappées legacy_action
UPDATE ai_review_queue
SET title = COALESCE(
  NULLIF(title, ''),
  review_metadata->>'original_action',
  review_type,
  'legacy_action'
)
WHERE COALESCE(title, '') = '';

-- ── 6. Supprimer colonnes OpenClaw obsolètes ──────────────────────
ALTER TABLE ai_review_queue
  DROP COLUMN IF EXISTS human_input_required,
  DROP COLUMN IF EXISTS raw_log_line;

-- ── 7. Contrainte review_type ─────────────────────────────────────
ALTER TABLE ai_review_queue DROP CONSTRAINT IF EXISTS ai_review_queue_review_type_check;
ALTER TABLE ai_review_queue ADD CONSTRAINT ai_review_queue_review_type_check
  CHECK (review_type IN (
    'knowledge_concept',
    'knowledge_procedure',
    'knowledge_role',
    'knowledge_faq',
    'document_summary',
    'learning_path',
    'quiz',
    'expert_pattern',
    'automation_suggestion',
    'legacy_action'
  ));

-- ── 8. Index ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_user_id ON ai_review_queue(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_review_queue_review_id ON ai_review_queue(review_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_status ON ai_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_created_at ON ai_review_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_review_type ON ai_review_queue(review_type);
CREATE INDEX IF NOT EXISTS idx_ai_review_queue_user_pending
  ON ai_review_queue(user_id, created_at DESC)
  WHERE status = 'pending';

DROP INDEX IF EXISTS idx_validation_queue_user_id;
DROP INDEX IF EXISTS idx_validation_queue_event_id;
DROP INDEX IF EXISTS idx_validation_queue_status;
DROP INDEX IF EXISTS idx_validation_queue_created_at;

-- ── 9. RLS ────────────────────────────────────────────────────────
ALTER TABLE ai_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own validation queue" ON ai_review_queue;
DROP POLICY IF EXISTS "Users can update their own validation queue" ON ai_review_queue;
DROP POLICY IF EXISTS "Users can view their own ai reviews" ON ai_review_queue;
DROP POLICY IF EXISTS "Users can update their own ai reviews" ON ai_review_queue;

CREATE POLICY "Users can view their own ai reviews"
  ON ai_review_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai reviews"
  ON ai_review_queue FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE ai_review_queue IS
  'AI Review Engine — file de révision humaine (1 review = 1 artefact).';
COMMENT ON COLUMN ai_review_queue.review_id IS
  'Identifiant stable externe (ex-event_id OpenClaw).';
COMMENT ON COLUMN ai_review_queue.review_type IS
  'Type métier de la révision (Knowledge, Quiz, legacy_action, …).';
COMMENT ON COLUMN ai_review_queue.published_at IS
  'Horodatage publication post-approbation (ex-executed_at OpenClaw).';

-- ── 10. VIEW legacy — supprimée Phase D.1 (008/011). Ne pas recréer validation_queue.

COMMIT;

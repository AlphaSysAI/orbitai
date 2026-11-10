-- ============================================
-- Seed démo Bison Futé (RégiAire Verdict)
-- Zone 5 pour les 3 aires démo (Sud-Ouest) + prévisions illustratives.
-- Exécuter après migration 026 (+ seeds 013/014/015 recommandés).
-- ============================================

BEGIN;

-- Zones Bison Futé sur les aires démo (Carcassonne / Pamiers / Castelnaudary ≈ zone 5)
UPDATE aires
SET bison_fute_zone = 5
WHERE bison_fute_zone IS NULL
  AND (
    city ILIKE '%Carcassonne%'
    OR city ILIKE '%Pamiers%'
    OR city ILIKE '%Castelnaudary%'
    OR city ILIKE '%Arzens%'
    OR id = '7ec3c50b-4893-4904-90d2-56e0ab04532a'::uuid
  );

-- Prévisions démo zone 5 (été 2026 — chassé-croisé)
INSERT INTO bison_fute_forecast (forecast_date, zone, direction, level)
VALUES
  ('2026-07-30', 5, 'aller', 'rouge'),
  ('2026-07-30', 5, 'retour', 'orange'),
  ('2026-08-01', 5, 'aller', 'rouge'),
  ('2026-08-01', 5, 'retour', 'rouge'),
  ('2026-08-06', 5, 'aller', 'noir'),
  ('2026-08-06', 5, 'retour', 'rouge'),
  ('2026-06-20', 5, 'aller', 'vert'),
  ('2026-06-20', 5, 'retour', 'vert'),
  (CURRENT_DATE, 5, 'aller', 'orange'),
  (CURRENT_DATE, 5, 'retour', 'orange')
ON CONFLICT (forecast_date, zone, direction)
DO UPDATE SET level = EXCLUDED.level;

COMMIT;

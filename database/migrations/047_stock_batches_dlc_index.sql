-- Migration 047 — Index partiel sur stock_batches(dlc) pour les alertes périmés
--
-- La requête « produits périmés / proches DLC » filtre par aire_id, dlc <= J+N et
-- quantity > 0, et elle est exécutée par aire sur tout le périmètre hiérarchique
-- (chef/région/direction). Un index partiel composite évite le tri/filtre en
-- mémoire et n'indexe que les lots encore en stock (les seuls pertinents).
--
-- À appliquer manuellement dans le SQL Editor Supabase (cf. CLAUDE.md).

CREATE INDEX IF NOT EXISTS idx_stock_batches_aire_dlc
  ON public.stock_batches (aire_id, dlc)
  WHERE quantity > 0;

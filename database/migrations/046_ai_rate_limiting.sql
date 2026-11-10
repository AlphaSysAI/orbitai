-- Migration 046 — Rate-limiting des appels IA (sécurisation budgétaire & anti-DoS)
--
-- Fournit un compteur de fenêtre glissante (fixed-window) atomique, partagé
-- entre toutes les instances serverless (Vercel), sans dépendance externe
-- (Redis/Upstash). Utilisé en amont de chaque appel OpenAI pour borner la
-- consommation par utilisateur / organisation.
--
-- À appliquer manuellement dans le SQL Editor Supabase (cf. CLAUDE.md).

-- Table interne de compteurs. Jamais lue/écrite directement par les clients :
-- seul le RPC SECURITY DEFINER ci-dessous y accède.
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  bucket        text        NOT NULL,
  window_start  timestamptz NOT NULL,
  count         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

-- RLS activée SANS policy : verrouille l'accès direct. Le RPC SECURITY DEFINER
-- (propriétaire = rôle de migration) contourne RLS pour maintenir les compteurs.
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

-- Incrémente le compteur de la fenêtre courante et retourne `true` tant que la
-- limite n'est pas dépassée. Atomique : l'upsert + RETURNING est une seule
-- instruction, donc sûr en concurrence.
CREATE OR REPLACE FUNCTION public.rate_limit_check(
  p_bucket         text,
  p_limit          integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_count  integer;
BEGIN
  -- Début de la fenêtre alignée sur p_window_seconds.
  v_window := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.rate_limit_hits AS r (bucket, window_start, count)
  VALUES (p_bucket, v_window, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET count = r.count + 1
  RETURNING r.count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

-- Nettoyage des fenêtres expirées (à câbler sur un cron Supabase quotidien).
CREATE OR REPLACE FUNCTION public.rate_limit_gc() RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_hits
  WHERE window_start < now() - interval '1 day';
$$;

REVOKE ALL ON FUNCTION public.rate_limit_check(text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.rate_limit_check(text, integer, integer)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rate_limit_gc() TO service_role;

import "server-only";

/** Clé serveur — éviter NEXT_PUBLIC_ en prod ; conservé pour compat .env existants. */
export function getOwmApiKey(): string | null {
  const key =
    process.env.OWM_API_KEY?.trim() ??
    process.env.NEXT_PUBLIC_OWM_API_KEY?.trim();
  return key || null;
}

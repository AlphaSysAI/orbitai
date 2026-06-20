/**
 * Génère un slug email à partir du nom d'une aire.
 * "Aire Arzens SUD" → "arzens-sud"
 * "Aire du Pays Catalan Nord" → "pays-catalan-nord"
 */
export function generateAireEmailSlug(name: string): string {
  let s = name.toLowerCase();

  // Normalise les accents
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Supprime les préfixes courants — ordre : du plus spécifique au moins spécifique
  s = s
    .replace(/^aire\s+de\s+la\s+/i, "")
    .replace(/^aire\s+de\s+les\s+/i, "")
    .replace(/^aire\s+de\s+l['']?\s*/i, "")
    .replace(/^aire\s+de\s+/i, "")
    .replace(/^aire\s+du\s+/i, "")
    .replace(/^aire\s+des\s+/i, "")
    .replace(/^aire\s+d['']?\s*/i, "")
    .replace(/^aire\s+/i, "");

  // Remplace tout ce qui n'est pas alphanumérique par un tiret
  s = s.replace(/[^a-z0-9]+/g, "-");

  // Nettoie les tirets en début/fin et les doublons
  s = s.replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");

  return s || "aire";
}

/**
 * Rend un slug unique en ajoutant un suffixe numérique si nécessaire.
 * `existing` = slugs déjà pris dans la BDD.
 */
export function makeSlugUnique(slug: string, existing: Set<string>): string {
  if (!existing.has(slug)) return slug;

  let n = 2;
  while (existing.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}

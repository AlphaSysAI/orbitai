import { z } from "zod";

/** Schémas feuille partagés — sans import verdict/schemas ni bison-fute/schemas. */
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

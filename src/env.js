import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_DISCORD_ID: z.string(),
    AUTH_DISCORD_SECRET: z.string(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // API Keys
    GOOGLE_PLACES_API_KEY: z.string().optional(), // Clé API Google Places pour récupérer les avis
    OPENAI_API_KEY: z.string().optional(), // Pourrait être déjà défini ailleurs
    // LEGACY — OpenClaw retiré du produit ; conservé pour routes/backend en migration (Phase B+)
    OPENCLAW_GATEWAY_URL: z.string().url().optional(),
    OPENCLAW_GATEWAY_TOKEN: z.string().optional(),
    OPENCLAW_AGENT_ID: z.string().optional(),
    OPENCLAW_VALIDATION_STATUS_TOKEN: z.string().optional(), // LEGACY Phase D — préférer REVIEW_POLLING_TOKEN
    // Token polling GET /api/review/status (Authorization: Bearer …)
    REVIEW_POLLING_TOKEN: z.string().optional(),
    // Tracker d'activité (script Python) — min. 32 caractères en production
    TRACKER_SIGNING_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(32)
        : z.string().min(32).optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    /** @deprecated Plus exposé en UI — conservé temporairement pour compat build */
    NEXT_PUBLIC_OPENCLAW_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true"),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
    AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENCLAW_GATEWAY_URL: process.env.OPENCLAW_GATEWAY_URL,
    OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN,
    OPENCLAW_AGENT_ID: process.env.OPENCLAW_AGENT_ID,
    OPENCLAW_VALIDATION_STATUS_TOKEN: process.env.OPENCLAW_VALIDATION_STATUS_TOKEN,
    REVIEW_POLLING_TOKEN: process.env.REVIEW_POLLING_TOKEN,
    TRACKER_SIGNING_SECRET: process.env.TRACKER_SIGNING_SECRET,
    NEXT_PUBLIC_OPENCLAW_ENABLED: process.env.NEXT_PUBLIC_OPENCLAW_ENABLED,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

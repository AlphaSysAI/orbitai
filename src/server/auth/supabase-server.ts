import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.types";

export type ServerSupabaseClient = SupabaseClient<Database>;

function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Configuration Supabase manquante: NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis."
    );
  }
  return { url, anonKey };
}

type CookieStore = {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: Record<string, unknown>): void;
};

type CookieWriteMode = "route-handler" | "server-component" | "read-only";

function buildServerClient(
  cookieStore: CookieStore,
  writeMode: CookieWriteMode
): ServerSupabaseClient {
  const { url, anonKey } = getSupabaseEnv();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (writeMode === "read-only") return;
        if (writeMode === "server-component") {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component en lecture seule : rafraîchissement session ignoré ici.
          }
          return;
        }
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  if (!cookieHeader.trim()) return [];
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return { name: part, value: "" };
      return {
        name: part.slice(0, separator),
        value: part.slice(separator + 1),
      };
    });
}


/**
 * Client Supabase service_role — contourne RLS.
 * Réservé aux opérations serveur après vérification explicite de propriété (ex. agent_actions_index).
 */
export function createServiceRoleSupabaseClient(): ServerSupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient<Database>(url, serviceRoleKey);
}

/**
 * Client Supabase serveur pour Server Components (Node).
 * Écriture cookies best-effort (contexte parfois lecture seule).
 */
export async function createServerSupabaseClient(): Promise<ServerSupabaseClient> {
  const cookieStore = await cookies();
  return buildServerClient(
    {
      getAll: () => cookieStore.getAll(),
      set: (name, value, options) => {
        cookieStore.set(name, value, options);
      },
    },
    "server-component"
  );
}

/**
 * Client Supabase pour Route Handlers (auth callback, API session).
 * Écriture cookies garantie via `next/headers` — requis pour exchangeCodeForSession.
 */
export async function createRouteHandlerSupabaseClient(): Promise<ServerSupabaseClient> {
  const cookieStore = await cookies();
  return buildServerClient(
    {
      getAll: () => cookieStore.getAll(),
      set: (name, value, options) => {
        cookieStore.set(name, value, options);
      },
    },
    "route-handler"
  );
}

/**
 * Client Supabase serveur à partir d'une `Request` (Edge Route Handlers).
 * Lecture seule des cookies : suffisant pour `auth.getUser()`.
 */
export function createServerSupabaseClientFromRequest(
  request: Request
): ServerSupabaseClient {
  const parsed = parseCookieHeader(request.headers.get("cookie") ?? "");
  return buildServerClient(
    {
      getAll: () => parsed,
      set: () => undefined,
    },
    "read-only"
  );
}

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

function mapUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email ?? undefined,
  };
}

/**
 * Récupère l'utilisateur authentifié via `getUser()` (validation JWT côté Supabase).
 * Retourne `null` si absent ou session invalide.
 */
export async function getAuthenticatedUser(
  supabase?: ServerSupabaseClient
): Promise<AuthenticatedUser | null> {
  const client = supabase ?? (await createServerSupabaseClient());
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return mapUser(data.user);
}

/**
 * Variante Edge : utilisateur authentifié à partir des cookies de la requête.
 */
export async function getAuthenticatedUserFromRequest(
  request: Request
): Promise<AuthenticatedUser | null> {
  const client = createServerSupabaseClientFromRequest(request);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return mapUser(data.user);
}

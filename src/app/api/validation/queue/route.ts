import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { fetchPendingValidations } from "@/lib/storage";

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient<Database>(supabaseUrl, supabaseKey);
}

/**
 * GET /api/validation/queue
 * Liste les tâches en attente de validation pour l'utilisateur authentifié.
 * Attend un user_id en query ou utilise la session Supabase si disponible.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json(
      { error: "user_id requis (query ou session)" },
      { status: 400 }
    );
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
  }

  const { data, error } = await fetchPendingValidations(supabase, userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}

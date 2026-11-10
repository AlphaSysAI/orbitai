// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireAdminUser } from "@/lib/admin/is-admin";
import { sanitizeModuleSelection } from "@/lib/organizations/module-catalog";
import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return forWrite(createClient<Database>(url, serviceKey));
}

const VERTICAL_MODULES = new Set(["regiaire_core", "hotel_core", "artisan_core"]);

export async function GET(request: Request) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return NextResponse.json({ error: "Accès refusé" }, {
      status: admin.reason === "unauthenticated" ? 401 : 403,
    });
  }

  const orgId = new URL(request.url).searchParams.get("orgId");
  if (!orgId || !z.string().uuid().safeParse(orgId).success) {
    return NextResponse.json({ error: "orgId invalide" }, { status: 400 });
  }

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });

  const { data: airesRaw, error: airesError } = await db
    .from("aires")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name");
  if (airesError) return NextResponse.json({ error: airesError.message }, { status: 500 });
  const aires = (airesRaw ?? []) as { id: string; name: string }[];

  const { data: modulesRaw } = await db
    .from("aire_modules")
    .select("aire_id, module_name")
    .eq("organization_id", orgId);
  const modules = (modulesRaw ?? []) as { aire_id: string; module_name: string }[];

  const byAire = new Map<string, string[]>();
  for (const m of modules) {
    const list = byAire.get(m.aire_id) ?? [];
    list.push(m.module_name);
    byAire.set(m.aire_id, list);
  }

  return NextResponse.json({
    aires: aires.map((a) => ({
      id: a.id,
      name: a.name,
      modules: byAire.get(a.id) ?? [],
    })),
  });
}

const PostSchema = z.object({
  aireId: z.string().uuid(),
  moduleNames: z.array(z.string()),
});

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return NextResponse.json({ error: "Accès refusé" }, {
      status: admin.reason === "unauthenticated" ? 401 : 403,
    });
  }

  const parsed = PostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });

  // Résout l'organisation de l'aire (source de vérité serveur, jamais le body).
  const { data: aireRaw, error: aireError } = await db
    .from("aires")
    .select("organization_id")
    .eq("id", parsed.data.aireId)
    .maybeSingle();
  if (aireError || !aireRaw) return NextResponse.json({ error: "Aire introuvable" }, { status: 404 });
  const aire = aireRaw as { organization_id: string };

  // Seuls des modules transverses valides (jamais un vertical) sont acceptés.
  const modules = sanitizeModuleSelection(parsed.data.moduleNames).filter(
    (m) => !VERTICAL_MODULES.has(m)
  );

  // Remplace l'ensemble des modules de l'aire (delete puis insert).
  const { error: delError } = await db
    .from("aire_modules")
    .delete()
    .eq("aire_id", parsed.data.aireId);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  if (modules.length > 0) {
    const { error: insError } = await db.from("aire_modules").insert(
      modules.map((module_name) => ({
        aire_id: parsed.data.aireId,
        organization_id: aire.organization_id,
        module_name,
      }))
    );
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

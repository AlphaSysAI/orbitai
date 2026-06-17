import { NextResponse } from "next/server";
import { z } from "zod";

import { listClientsForAdmin, provisionClient } from "@/lib/admin/provision-client";
import { requireAdminUser } from "@/lib/admin/is-admin";
import { VALID_MODULE_IDS } from "@/lib/organizations/module-catalog";

const createClientSchema = z.object({
  companyName: z.string().min(1, "Nom de l'entreprise requis"),
  managerFirstName: z.string().min(1, "Prénom requis"),
  managerLastName: z.string().min(1, "Nom requis"),
  managerEmail: z.string().email("Email invalide"),
  businessSector: z.string().min(1, "Métier requis"),
  moduleNames: z
    .array(z.string())
    .refine((names) => names.every((n) => VALID_MODULE_IDS.has(n)), {
      message: "Module inconnu dans la sélection",
    }),
});

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    const status = admin.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Authentification requise" : "Accès admin refusé" }, { status });
  }

  try {
    const clients = await listClientsForAdmin();
    return NextResponse.json({ clients });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    const status = admin.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: status === 401 ? "Authentification requise" : "Accès admin refusé" }, { status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  try {
    const result = await provisionClient(parsed.data);
    return NextResponse.json({ success: true, client: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("existe déjà") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

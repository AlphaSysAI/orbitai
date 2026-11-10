// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";
import { z } from "zod";

import { AdminClientAiresPayloadSchema } from "@/lib/admin/client-aire-schema";
import { syncAiresForOrganization } from "@/lib/admin/client-aires";
import { deleteClient, updateClientModules } from "@/lib/admin/provision-client";
import { VALID_MODULE_IDS } from "@/lib/organizations/module-catalog";
import { requireAdminUser } from "@/lib/admin/is-admin";

const UpdateModulesPayloadSchema = z.object({
  moduleNames: z.array(z.string()).refine(
    (names) => names.every((n) => VALID_MODULE_IDS.has(n)),
    { message: "Module inconnu dans la sélection" }
  ),
});

type RouteParams = { params: Promise<{ organizationId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    const status = admin.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json(
      { error: status === 401 ? "Authentification requise" : "Accès admin refusé" },
      { status }
    );
  }

  const { organizationId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  if (!z.string().uuid().safeParse(organizationId).success) {
    return NextResponse.json({ error: "Identifiant client invalide" }, { status: 400 });
  }

  // Mise à jour des modules
  const modulesParsed = UpdateModulesPayloadSchema.safeParse(body);
  if (modulesParsed.success) {
    try {
      await updateClientModules(organizationId, modulesParsed.data.moduleNames);
      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur serveur";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Sync des aires
  const airesParsed = AdminClientAiresPayloadSchema.safeParse(body);
  if (!airesParsed.success) {
    return NextResponse.json(
      { error: airesParsed.error.errors[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  try {
    await syncAiresForOrganization(organizationId, airesParsed.data.aires);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    const status = admin.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json(
      { error: status === 401 ? "Authentification requise" : "Accès admin refusé" },
      { status }
    );
  }

  const { organizationId } = await params;

  if (!z.string().uuid().safeParse(organizationId).success) {
    return NextResponse.json({ error: "Identifiant client invalide" }, { status: 400 });
  }

  try {
    await deleteClient(organizationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

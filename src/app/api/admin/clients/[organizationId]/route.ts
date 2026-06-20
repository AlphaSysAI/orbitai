import { NextResponse } from "next/server";
import { z } from "zod";

import { AdminClientAiresPayloadSchema } from "@/lib/admin/client-aire-schema";
import { syncAiresForOrganization } from "@/lib/admin/client-aires";
import { requireAdminUser } from "@/lib/admin/is-admin";

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

  const parsed = AdminClientAiresPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  if (!z.string().uuid().safeParse(organizationId).success) {
    return NextResponse.json({ error: "Identifiant client invalide" }, { status: 400 });
  }

  try {
    await syncAiresForOrganization(organizationId, parsed.data.aires);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

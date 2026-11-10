// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";
import { z } from "zod";

import { AdminClientAiresPayloadSchema } from "@/lib/admin/client-aire-schema";
import { syncAiresForOrganization } from "@/lib/admin/client-aires";
import { deleteClient, setClientFeature } from "@/lib/admin/provision-client";
import { SELLABLE_FEATURE_IDS } from "@/lib/organizations/feature-catalog";
import { requireAdminUser } from "@/lib/admin/is-admin";

const ToggleFeaturePayloadSchema = z.object({
  featureId: z.string().refine((id) => SELLABLE_FEATURE_IDS.has(id), {
    message: "Feature inconnue",
  }),
  enabled: z.boolean(),
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

  // Activation / désactivation d'une feature
  const featureParsed = ToggleFeaturePayloadSchema.safeParse(body);
  if (featureParsed.success) {
    try {
      const enabledFeatureIds = await setClientFeature(
        organizationId,
        featureParsed.data.featureId,
        featureParsed.data.enabled
      );
      return NextResponse.json({ success: true, enabledFeatureIds });
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

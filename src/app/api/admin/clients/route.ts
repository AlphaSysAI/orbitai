// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";
import { z } from "zod";

import { listClientsForAdmin, provisionClient } from "@/lib/admin/provision-client";
import { requireAdminUser } from "@/lib/admin/is-admin";
import { AdminClientAireSchema } from "@/lib/admin/client-aire-schema";
import {
  SELLABLE_FEATURE_IDS,
  AIRE_FEATURE_IDS,
} from "@/lib/organizations/feature-catalog";

const createClientSchema = z
  .object({
    companyName: z.string().min(1, "Nom de l'entreprise requis"),
    managerFirstName: z.string().min(1, "Prénom requis"),
    managerLastName: z.string().min(1, "Nom requis"),
    managerEmail: z.string().email("Email invalide"),
    businessSector: z.string().min(1, "Métier requis"),
    featureIds: z
      .array(z.string())
      .refine((ids) => ids.every((id) => SELLABLE_FEATURE_IDS.has(id)), {
        message: "Feature inconnue dans la sélection",
      }),
    aires: z.array(AdminClientAireSchema).optional(),
  })
  .superRefine((data, ctx) => {
    const hasAireFeature = data.featureIds.some((id) =>
      AIRE_FEATURE_IDS.includes(id)
    );
    const aireCount = data.aires?.length ?? 0;
    // Les aires ne sont pertinentes qu'avec au moins une feature Orbit Aire.
    if (!hasAireFeature && aireCount > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Les aires ne sont autorisées qu'avec au moins une feature Orbit Aire.",
        path: ["aires"],
      });
    }
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
    return NextResponse.json({
      success: true,
      client: {
        organizationId: result.organizationId,
        managerEmail: result.managerEmail,
        tempPassword: result.tempPassword,
        enabledFeatureIds: result.enabledFeatureIds,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("existe déjà") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

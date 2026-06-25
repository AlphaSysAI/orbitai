// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminUser } from "@/lib/admin/is-admin";
import {
  getOrgHierarchyData,
  provisionAccount,
} from "@/lib/admin/provision-account";
import { AdminClientAireSchema } from "@/lib/admin/client-aire-schema";
import { VALID_MODULE_IDS } from "@/lib/organizations/module-catalog";

const identitySchema = {
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().optional().nullable(),
};

const accountSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("direction_france"),
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
    aires: z.array(AdminClientAireSchema).optional(),
  }),
  z.object({
    role: z.literal("directeur_region"),
    organizationId: z.string().uuid(),
    ...identitySchema,
  }),
  z.object({
    role: z.literal("chef_secteur"),
    organizationId: z.string().uuid(),
    parentRegionalUserId: z.string().uuid("Directeur régional requis"),
    secteurName: z.string().min(1, "Nom du secteur requis"),
    aireIds: z.array(z.string().uuid()),
    ...identitySchema,
  }),
  z.object({
    role: z.literal("gerant"),
    organizationId: z.string().uuid(),
    parentChefUserId: z.string().uuid("Chef de secteur requis"),
    aireIds: z.array(z.string().uuid()),
    ...identitySchema,
  }),
]);

export async function GET(request: Request) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    const status = admin.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: "Accès refusé" }, { status });
  }

  const orgId = new URL(request.url).searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId requis" }, { status: 400 });
  }

  try {
    const data = await getOrgHierarchyData(orgId);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    const status = admin.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: "Accès refusé" }, { status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  try {
    const result = await provisionAccount(parsed.data);
    return NextResponse.json({ success: true, account: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    const status = message.includes("existe déjà") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextRequest } from "next/server";

import { searchBanAddresses } from "@/features/regiaire/aires/lib/ban-address";
import { requireAdminUser } from "@/lib/admin/is-admin";

export async function GET(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return Response.json({ error: "Accès refusé" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return Response.json({ suggestions: [] });
  }

  const suggestions = await searchBanAddresses(q);
  return Response.json({ suggestions });
}

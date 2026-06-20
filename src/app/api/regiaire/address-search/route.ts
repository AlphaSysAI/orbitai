import { NextRequest } from "next/server";

import { searchBanAddresses } from "@/features/regiaire/aires/lib/ban-address";
import { requireRegiaireAccess } from "@/lib/organizations/access";

export async function GET(req: NextRequest) {
  const access = await requireRegiaireAccess();
  if (!access.allowed) {
    return Response.json({ error: "Accès refusé" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return Response.json({ suggestions: [] });
  }

  const suggestions = await searchBanAddresses(q);
  return Response.json({ suggestions });
}

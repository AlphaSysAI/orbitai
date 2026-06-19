import { NextResponse } from "next/server";

import { refreshBisonFuteForecast } from "@/features/regiaire/verdict/bison-fute/refresh-forecast";

export const runtime = "nodejs";

/**
 * Cron : rafraîchit les prévisions Bison Futé depuis le CSV data.gouv.fr.
 * Auth : Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshBisonFuteForecast();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Bison Futé refresh failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refresh failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}

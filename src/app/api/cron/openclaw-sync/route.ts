import { NextResponse } from "next/server";
import { runOpenClawSync } from "@/lib/openclaw/sync-worker";

export const runtime = "nodejs";

/**
 * Cron / webhook : exécute le worker de synchronisation OpenClaw.
 * Protéger par un secret (ex. CRON_SECRET) pour éviter les appels non autorisés.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET ?? process.env.OPENCLAW_SYNC_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runOpenClawSync();
    return NextResponse.json(result);
  } catch (err) {
    console.error("OpenClaw sync failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}

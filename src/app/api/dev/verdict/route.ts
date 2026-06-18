// src/app/api/dev/verdict/route.ts  — TEMPORAIRE, à supprimer après
import { NextRequest } from "next/server";
import { generateVerdict } from "@/features/regiaire/verdict/actions/generate-verdict";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response("nope", { status: 404 });
  const aireId = req.nextUrl.searchParams.get("aireId");
  if (!aireId) {
    return Response.json({ success: false, error: "aireId requis" }, { status: 400 });
  }
  const date = req.nextUrl.searchParams.get("date") ?? undefined;
  const result = await generateVerdict(aireId, date);
  return Response.json(result);
}

// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";

import { resolveVoiceContext } from "@/features/voice/lib/tool-auth";
import { hotelAvailability } from "@/features/voice/hotel/tools";

export async function POST(request: Request) {
  const resolved = await resolveVoiceContext(request, "hotel");
  if (!resolved.ok) return resolved.response;
  const { orgId, db, body } = resolved.ctx;
  return NextResponse.json(await hotelAvailability(db, orgId, body));
}

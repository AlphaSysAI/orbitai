// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";

import { resolveVoiceContext } from "@/features/voice/lib/tool-auth";
import { hotelReserve } from "@/features/voice/hotel/tools";

export async function POST(request: Request) {
  const resolved = await resolveVoiceContext(request, "hotel");
  if (!resolved.ok) return resolved.response;
  const { orgId, db, body, callerNumber } = resolved.ctx;

  const result = await hotelReserve(db, orgId, body);

  // Journalise l'appel (rattaché à la réservation si créée).
  await db.from("voice_call_logs").insert({
    organization_id: orgId,
    vertical: "hotel",
    caller_number: callerNumber,
    intent: "reservation",
    transcript: typeof body.transcript === "string" ? body.transcript : null,
    reservation_id: "reservation_id" in result ? (result.reservation_id as string) : null,
  });

  return NextResponse.json(result);
}

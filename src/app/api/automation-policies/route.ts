import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  fetchAutomationPoliciesForUser,
  getSuccessCountByAction,
  upsertAutomationPolicy,
  updateAutomationPolicyStatus,
} from "@/lib/storage";
import type { AutomationPolicyStatus } from "@/types/database.types";

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient<Database>(supabaseUrl, supabaseKey);
}

export type AutomationPolicyItem = {
  id: string;
  action_type: string;
  success_count: number;
  status: AutomationPolicyStatus;
};

/**
 * GET /api/automation-policies?user_id=...
 * Retourne success_count par action_type + statut de la politique.
 * Crée une ligne PENDING si success_count >= 50 et aucune politique n'existe.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id requis" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
  }

  const { data: successCounts, error: errCount } = await getSuccessCountByAction(supabase, userId);
  if (errCount) {
    return NextResponse.json({ error: errCount.message }, { status: 500 });
  }

  const { data: policies, error: errPolicies } = await fetchAutomationPoliciesForUser(supabase, userId);
  if (errPolicies) {
    return NextResponse.json({ error: errPolicies.message }, { status: 500 });
  }

  const policyByAction = new Map(policies.map((p) => [p.action_type, p]));
  const items: AutomationPolicyItem[] = [];

  for (const { action_type, success_count } of successCounts) {
    if (success_count < 50) continue;
    let policy = policyByAction.get(action_type);
    if (!policy) {
      const { data: created } = await upsertAutomationPolicy(supabase, {
        user_id: userId,
        action_type,
        status: "PENDING",
      });
      policy = created ?? undefined;
      if (policy) policyByAction.set(action_type, policy);
    }
    if (!policy?.id) continue;
    items.push({
      id: policy.id,
      action_type,
      success_count,
      status: policy.status,
    });
  }

  return NextResponse.json({ items });
}

/**
 * PATCH /api/automation-policies
 * Body: { id: string, status: AutomationPolicyStatus }
 * Met à jour le statut (palier 1/2 accepté ou refusé, ou révoqué DECLINED_100).
 */
export async function PATCH(req: Request) {
  let body: { id: string; status: AutomationPolicyStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { id, status } = body;
  if (!id || !status) {
    return NextResponse.json({ error: "id et status requis" }, { status: 400 });
  }
  const allowed: AutomationPolicyStatus[] = ["PENDING", "DECLINED_50", "DECLINED_100", "ENABLED"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "status invalide" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
  }

  const { error } = await updateAutomationPolicyStatus(supabase, id, status);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

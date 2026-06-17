/**
 * Phase C.2 — Smoke test UI (parcours Révisions IA + vérifs statiques)
 * Usage: node scripts/phase-c2-ui-smoke.mjs --api-base http://localhost:3002
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const API_BASE = process.argv.includes("--api-base")
  ? process.argv[process.argv.indexOf("--api-base") + 1]
  : "http://localhost:3002";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, serviceKey);

const results = { ui: {}, static: {}, api: {}, errors: [] };
const log = (ok, section, msg) => {
  console.log(`${ok ? "✓" : "✗"} [${section}] ${msg}`);
  if (!ok) results.errors.push(`[${section}] ${msg}`);
};

async function getAuth() {
  const email = "contact@alphasys.tech";
  const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const anon = createClient(url, anonKey);
  const { data: otp } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  const cookieStore = [];
  const serverClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore,
      setAll: (toSet) => {
        for (const c of toSet) {
          const idx = cookieStore.findIndex((x) => x.name === c.name);
          if (c.value) {
            if (idx >= 0) cookieStore[idx] = { name: c.name, value: c.value };
            else cookieStore.push({ name: c.name, value: c.value });
          } else if (idx >= 0) cookieStore.splice(idx, 1);
        }
      },
    },
  });
  await serverClient.auth.setSession({
    access_token: otp.session.access_token,
    refresh_token: otp.session.refresh_token,
  });
  return {
    userId: otp.session.user.id,
    cookieHeader: cookieStore.map((c) => `${c.name}=${c.value}`).join("; "),
  };
}

function scanUiFilesForOpenClaw() {
  const uiRoots = ["src/components", "src/features/pillars", "src/app"];
  const hits = [];
  for (const root of uiRoots) {
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules") walk(p);
        else if (/\.(tsx|jsx)$/.test(entry.name)) {
          const content = readFileSync(p, "utf8");
          if (/OpenClaw|openclaw|mode Agent/i.test(content)) hits.push(p);
        }
      }
    };
    walk(join(process.cwd(), root));
  }
  return hits;
}

async function main() {
  console.log("Phase C.2 UI smoke —", API_BASE);

  // Static: no OpenClaw in UI TSX
  const openClawUiHits = scanUiFilesForOpenClaw();
  log(openClawUiHits.length === 0, "STATIC", `Aucune mention OpenClaw/mode Agent dans UI (${openClawUiHits.length} hit)`);
  results.static.openclaw_ui_hits = openClawUiHits;

  // Static: Révisions IA tab exists
  const nav = readFileSync("src/features/pillars/components/ContextualNavigation.tsx", "utf8");
  log(nav.includes("Révisions IA"), "STATIC", "Onglet Révisions IA présent dans navigation");
  log(nav.includes("Validation OpenClaw") === false, "STATIC", "Pas de label Validation OpenClaw");

  const auth = await getAuth();

  // Pages load
  for (const path of ["/", "/login"]) {
    const res = await fetch(`${API_BASE}${path}`);
    log(res.status < 500, "UI", `GET ${path} → ${res.status}`);
  }

  // Create test review for UI flow
  const reviewId = `phase_c2_ui_${Date.now()}`;
  const { data: testRow, error: insErr } = await admin
    .from("ai_review_queue")
    .insert({
      review_id: reviewId,
      user_id: auth.userId,
      review_type: "legacy_action",
      title: "phase_c2_ui_smoke_action",
      summary: "Review smoke test Phase C.2 — à approuver ou rejeter",
      proposed_payload: { test: true, label: "phase_c2_ui" },
      source_module: "legacy_openclaw",
      status: "pending",
      review_metadata: {
        test: true,
        created_by: "phase_c_2_ui",
        original_action: "phase_c2_ui_smoke_action",
      },
    })
    .select()
    .single();
  log(!insErr, "UI", `Review test créée (${reviewId})`);

  const headers = { Cookie: auth.cookieHeader, "Content-Type": "application/json" };

  // Parcours Révisions IA (API = ce que fait ValidationDashboard)
  const queue = await fetch(`${API_BASE}/api/review/queue`, { headers });
  const queueBody = await queue.json();
  const item = queueBody.items?.find((i) => i.review_id === reviewId || i.event_id === reviewId);
  log(queue.status === 200 && !!item, "UI", `File Révisions IA: item visible (${item?.action})`);
  log(item?.rationale?.includes("Phase C.2") ?? false, "UI", "Résumé IA affichable (rationale)");

  // Approuver (bouton Approuver)
  const approve = await fetch(`${API_BASE}/api/tasks/validate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ task_id: testRow.id, status: "approved", user_id: auth.userId }),
  });
  log(approve.status === 200, "UI", `Bouton Approuver → ${approve.status}`);

  // Reject flow on second item
  const reviewId2 = `phase_c2_ui_reject_${Date.now()}`;
  const { data: row2 } = await admin
    .from("ai_review_queue")
    .insert({
      review_id: reviewId2,
      user_id: auth.userId,
      review_type: "legacy_action",
      title: "phase_c2_reject",
      summary: "Reject smoke",
      proposed_payload: {},
      source_module: "legacy_openclaw",
      status: "pending",
      review_metadata: { test: true, created_by: "phase_c_2_ui", original_action: "phase_c2_reject" },
    })
    .select()
    .single();
  const reject = await fetch(`${API_BASE}/api/tasks/validate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ task_id: row2.id, status: "rejected" }),
  });
  log(reject.status === 200, "UI", `Bouton Rejeter → ${reject.status}`);

  // Chat RAG — route existe (POST chat)
  const chat = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages: [{ role: "user", content: "ping smoke test" }] }),
  });
  log(chat.status !== 404, "UI", `Chat RAG POST /api/chat → ${chat.status} (non 404)`);

  // Upload document — route extract existe
  const extract = await fetch(`${API_BASE}/api/extract`, { method: "POST", headers, body: "{}" });
  log(extract.status !== 404, "UI", `Upload/extract POST /api/extract → ${extract.status} (non 404)`);

  // detect-tasks
  const detect = await fetch(`${API_BASE}/api/detect-tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text: "smoke test" }),
  });
  log(detect.status !== 404, "UI", `Détection tâches POST /api/detect-tasks → ${detect.status} (non 404)`);

  // Cleanup
  await admin.from("ai_review_queue").delete().in("review_id", [reviewId, reviewId2]);
  await admin.from("agent_actions_index").delete().eq("event_id", reviewId);
  log(true, "UI", "Données test nettoyées");

  console.log("\n=== RÉSUMÉ ===");
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

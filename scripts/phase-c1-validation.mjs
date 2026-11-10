/**
 * Phase C.1 / D.1 — Validation AI Review Engine (Supabase + API canonique /api/review/*)
 * Usage: node scripts/phase-c1-validation.mjs [--api-base http://localhost:3000] [--cleanup]
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const API_BASE = process.argv.includes("--api-base")
  ? process.argv[process.argv.indexOf("--api-base") + 1]
  : "http://localhost:3000";
const CLEANUP = process.argv.includes("--cleanup");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = {
  sql: {},
  api: {},
  errors: [],
};

function log(section, msg, ok = true) {
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} [${section}] ${msg}`);
  if (!ok) results.errors.push(`[${section}] ${msg}`);
}

async function countTable(name) {
  const { count, error } = await admin.from(name).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${name} count: ${error.message}`);
  return count ?? 0;
}

function isMissingRelationError(error) {
  const msg = error?.message ?? "";
  const code = error?.code ?? "";
  return (
    code === "42P01" ||
    msg.includes("does not exist") ||
    msg.includes("Could not find the table") ||
    msg.includes("schema cache")
  );
}

async function getAuthSession(email) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const tokenHash = linkData.properties.hashed_token;
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: otpErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (otpErr) throw otpErr;

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
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  });

  const cookieHeader = cookieStore.map((c) => `${c.name}=${c.value}`).join("; ");
  return { session: sessionData.session, cookieHeader };
}

async function apiFetch(path, options = {}, auth = null) {
  const headers = { "Content-Type": "application/json", ...(options.headers ?? {}) };
  if (auth?.cookieHeader) headers.Cookie = auth.cookieHeader;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, headers: res.headers, body };
}

async function verifySqlState() {
  console.log("\n=== 1. ÉTAT SQL ===\n");

  const countAr = await countTable("ai_review_queue");
  results.sql.count_ai_review_queue = countAr;
  log("SQL", `COUNT ai_review_queue: ${countAr}`);

  const { error: viewErr } = await admin.from("validation_queue").select("*", { count: "exact", head: true });
  const viewDropped = viewErr != null && isMissingRelationError(viewErr);
  results.sql.validation_queue_view_dropped = viewDropped;
  if (viewDropped) {
    log("SQL", "VIEW validation_queue absente (migration 008 appliquée)");
  } else if (!viewErr) {
    log("SQL", "VIEW validation_queue encore présente — appliquer migration 008", false);
  } else {
    log("SQL", `Erreur inattendue validation_queue: ${viewErr.message}`, false);
  }

  const { error: newColErr } = await admin
    .from("ai_review_queue")
    .select(
      "review_id, review_type, proposed_payload, summary, published_at, review_metadata, subject_type, priority"
    )
    .limit(0);
  log("SQL", `Colonnes ai_review_queue accessibles: ${!newColErr}`, !newColErr);
}

async function createTestReview(userId) {
  const reviewId = `phase_c1_test_${Date.now()}`;
  const row = {
    review_id: reviewId,
    user_id: userId,
    review_type: "legacy_action",
    title: "phase_c1_test_action",
    summary: "Review de test Phase C.1",
    proposed_payload: { test: true, action: "phase_c1_test_action" },
    source_module: "legacy_openclaw",
    status: "pending",
    review_metadata: {
      test: true,
      created_by: "phase_c_1",
      human_input_required: true,
      raw_log_line: { line: "test raw log" },
      original_action: "phase_c1_test_action",
    },
    priority: 0,
  };

  const { data, error } = await admin.from("ai_review_queue").insert(row).select().single();
  if (error) throw error;

  results.sql.test_review_id = reviewId;
  results.sql.test_row_id = data.id;

  log("SQL", `Ligne test créée review_id=${reviewId} id=${data.id}`);

  const checks = [
    ["review_id présent", typeof data.review_id === "string" && data.review_id.length > 0],
    ["review_type legacy_action", data.review_type === "legacy_action"],
    ["metadata raw_log_line", data.review_metadata?.raw_log_line?.line === "test raw log"],
    ["metadata human_input_required", data.review_metadata?.human_input_required === true],
    ["metadata test flag", data.review_metadata?.test === true],
  ];

  for (const [label, ok] of checks) {
    log("SQL", label, ok);
    results.sql[label] = ok;
  }

  return { row: data, reviewId, internalId: data.id };
}

async function testApiRoutes(auth, reviewId) {
  console.log("\n=== 2. TESTS API (/api/review/*) ===\n");

  const noAuth = await apiFetch("/api/review/queue");
  log("API", `GET /api/review/queue sans auth → ${noAuth.status}`, noAuth.status === 401);

  const queue = await apiFetch("/api/review/queue", {}, auth);
  results.api.review_queue = { status: queue.status, itemCount: queue.body?.items?.length };
  log("API", `GET /api/review/queue → ${queue.status}, items=${queue.body?.items?.length ?? "?"}`);

  const item = queue.body?.items?.find((i) => i.review_id === reviewId || i.event_id === reviewId);
  const aliasFields = item
    ? ["review_id", "event_id", "review_type", "action", "proposed_payload", "payload", "summary", "rationale"].every(
        (k) => k in item
      )
    : false;
  log("API", `Champs canoniques + aliases présents: ${aliasFields}`, aliasFields);
  results.api.canonical_and_legacy_fields = aliasFields;

  const statusBefore = await apiFetch(`/api/review/status?event_id=${reviewId}`, {}, auth);
  log("API", `GET /api/review/status → ${statusBefore.status} status=${statusBefore.body?.status}`);

  const rejectRes = await apiFetch(
    "/api/review/reject",
    { method: "POST", body: JSON.stringify({ review_id: reviewId, reason: "phase_c1_reject_test" }) },
    auth
  );
  log("API", `POST /api/review/reject → ${rejectRes.status}`, rejectRes.status === 200);

  const reviewId2 = `phase_c1_test_approve_${Date.now()}`;
  const { data: row2, error: insErr } = await admin
    .from("ai_review_queue")
    .insert({
      review_id: reviewId2,
      user_id: auth.session.user.id,
      review_type: "legacy_action",
      title: "phase_c1_approve_test",
      summary: "Test approve",
      proposed_payload: { test: true },
      source_module: "legacy_openclaw",
      status: "pending",
      review_metadata: { test: true, created_by: "phase_c_1", original_action: "phase_c1_approve_test" },
    })
    .select()
    .single();
  if (insErr) throw insErr;

  const approveRes = await apiFetch(
    "/api/review/approve",
    { method: "POST", body: JSON.stringify({ event_id: reviewId2 }) },
    auth
  );
  log("API", `POST /api/review/approve → ${approveRes.status}`, approveRes.status === 200);
  results.api.approve = approveRes.status;

  const { data: approvedRow } = await admin.from("ai_review_queue").select("*").eq("review_id", reviewId2).single();
  log("API", `Après approve status=${approvedRow?.status}`, approvedRow?.status === "approved");
  log("API", `published_at null après approve (worker): ${approvedRow?.published_at == null}`, approvedRow?.published_at == null);

  const { count: indexCount } = await admin
    .from("agent_actions_index")
    .select("*", { count: "exact", head: true })
    .eq("event_id", reviewId2);
  log("API", `agent_actions_index upsert legacy: count=${indexCount}`, (indexCount ?? 0) >= 1);

  const reviewId3 = `phase_c1_tasks_validate_${Date.now()}`;
  const { data: row3, error: ins3 } = await admin
    .from("ai_review_queue")
    .insert({
      review_id: reviewId3,
      user_id: auth.session.user.id,
      review_type: "legacy_action",
      title: "phase_c1_tasks_validate",
      summary: "Test tasks/validate",
      proposed_payload: { test: true },
      source_module: "legacy_openclaw",
      status: "pending",
      review_metadata: { test: true, created_by: "phase_c_1", original_action: "phase_c1_tasks_validate" },
    })
    .select()
    .single();
  if (ins3) throw ins3;

  const taskApprove = await apiFetch(
    "/api/tasks/validate",
    { method: "POST", body: JSON.stringify({ task_id: row3.id, status: "approved", user_id: auth.session.user.id }) },
    auth
  );
  log("API", `POST /api/tasks/validate approve → ${taskApprove.status}`, taskApprove.status === 200);
  results.api.tasks_validate_approve = taskApprove.status;

  const reviewId4 = `phase_c1_tasks_reject_${Date.now()}`;
  const { data: row4, error: ins4 } = await admin
    .from("ai_review_queue")
    .insert({
      review_id: reviewId4,
      user_id: auth.session.user.id,
      review_type: "legacy_action",
      title: "phase_c1_tasks_reject",
      summary: "Test tasks reject",
      proposed_payload: { test: true },
      source_module: "legacy_openclaw",
      status: "pending",
      review_metadata: { test: true, created_by: "phase_c_1", original_action: "phase_c1_tasks_reject" },
    })
    .select()
    .single();
  if (ins4) throw ins4;

  const taskReject = await apiFetch(
    "/api/tasks/validate",
    { method: "POST", body: JSON.stringify({ task_id: row4.id, status: "rejected", rejection_reason: "phase_c1" }) },
    auth
  );
  log("API", `POST /api/tasks/validate reject → ${taskReject.status}`, taskReject.status === 200);
  results.api.tasks_validate_reject = taskReject.status;

  const noAuthTask = await apiFetch("/api/tasks/validate", {
    method: "POST",
    body: JSON.stringify({ task_id: row4.id, status: "approved" }),
  });
  log("API", `POST /api/tasks/validate sans auth → ${noAuthTask.status}`, noAuthTask.status === 401);

  const legacyRoute = await apiFetch("/api/validation/queue", {}, auth);
  log("API", `/api/validation/queue supprimée → ${legacyRoute.status}`, legacyRoute.status === 404);

  results.api.test_review_ids = [reviewId, reviewId2, reviewId3, reviewId4];

  if (CLEANUP) {
    await admin.from("ai_review_queue").delete().in("review_id", [reviewId, reviewId2, reviewId3, reviewId4]);
    await admin.from("agent_actions_index").delete().in("event_id", [reviewId2, reviewId3]);
    log("API", "Données test nettoyées (--cleanup)");
  }
}

async function main() {
  console.log("Phase C.1 / D.1 validation — Supabase + API /api/review/*");
  console.log(`API base: ${API_BASE}`);

  await verifySqlState();

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1 });
  const testUser = users?.users?.[0];
  if (!testUser?.email) {
    log("AUTH", "Aucun utilisateur auth trouvé", false);
    process.exit(1);
  }
  log("AUTH", `Utilisateur test: ${testUser.email} (${testUser.id})`);

  let auth;
  try {
    auth = await getAuthSession(testUser.email);
    log("AUTH", "Session obtenue via magic link admin");
  } catch (e) {
    log("AUTH", `Impossible d'obtenir session: ${e.message}`, false);
    console.log("\n⚠ Tests API ignorés — démarrer le dev server et relancer.");
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }

  await createTestReview(testUser.id);

  try {
    await testApiRoutes(auth, results.sql.test_review_id);
  } catch (e) {
    if (e.cause?.code === "ECONNREFUSED" || e.message?.includes("fetch failed")) {
      log("API", `Serveur non joignable sur ${API_BASE} — lancer: npm run dev`, false);
    } else {
      log("API", e.message, false);
    }
  }

  console.log("\n=== RÉSUMÉ ===");
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

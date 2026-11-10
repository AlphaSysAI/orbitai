// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";

import {
  assertOwnership,
  authErrorToResponse,
  createServerSupabaseClientFromRequest,
  createServiceRoleSupabaseClient,
  getOptionalAuthUserFromRequest,
  requireAuthUserFromRequest,
  unauthorizedResponse,
  verifyReviewPollingToken,
} from "@/server/auth";
import type { AiReviewQueueRow } from "@/types/database.types";

import {
  fetchPendingReviews,
  getReviewById,
  getReviewByReviewId,
  updateReviewStatus,
  upsertAgentActionIndex,
} from "./queue";
import { publishReview } from "./publish";
import {
  getLegacyActionLabel,
  mapReviewRowToApiItem,
  type ApproveReviewBody,
  type RejectReviewBody,
  type ValidateTaskBody,
} from "./types";

function resolveReviewId(body: { event_id?: string; review_id?: string }): string | undefined {
  return body.review_id ?? body.event_id;
}

function formatStatusJson(row: AiReviewQueueRow) {
  return {
    event_id: row.review_id,
    review_id: row.review_id,
    status: row.status,
    validated_at: row.validated_at ?? undefined,
    rejection_reason: row.rejection_reason ?? undefined,
  };
}

function formatStatusResponse(row: AiReviewQueueRow) {
  return NextResponse.json(formatStatusJson(row));
}

async function indexLegacyAgentAction(row: AiReviewQueueRow, userId: string): Promise<Error | null> {
  const serviceSupabase = createServiceRoleSupabaseClient();
  if (!serviceSupabase) {
    return new Error("Configuration service_role manquante");
  }

  const actionLabel = getLegacyActionLabel(row);
  const fullText = `Action: ${actionLabel}\nRationale: ${row.summary}\nPayload: ${JSON.stringify(row.proposed_payload)}`;
  const { error } = await upsertAgentActionIndex(serviceSupabase, {
    event_id: row.review_id,
    user_id: userId,
    action: actionLabel,
    status: "approved",
    payload: row.proposed_payload ?? {},
    rationale: row.summary ?? "",
    full_text: fullText,
  });
  return error;
}

/** GET /api/review/queue */
export async function handleReviewQueue(request: Request): Promise<NextResponse> {
  try {
    const user = await requireAuthUserFromRequest(request);
    const supabase = createServerSupabaseClientFromRequest(request);
    const { data, error } = await fetchPendingReviews(supabase, user.id);

    if (error) {
      console.error("[review/queue] Erreur chargement file.");
      return NextResponse.json({ error: "Erreur lors du chargement" }, { status: 500 });
    }

    return NextResponse.json({ items: data.map(mapReviewRowToApiItem) });
  } catch (error) {
    return authErrorToResponse(error);
  }
}

/** POST /api/review/approve */
export async function handleReviewApprove(request: Request): Promise<NextResponse> {
  let body: ApproveReviewBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const reviewId = resolveReviewId(body);
  if (!reviewId) {
    return NextResponse.json({ error: "event_id requis" }, { status: 400 });
  }

  try {
    const user = await requireAuthUserFromRequest(request);
    const sessionSupabase = createServerSupabaseClientFromRequest(request);

    const { data: row, error: fetchError, notFound } =
      await getReviewByReviewId(sessionSupabase, reviewId);

    if (notFound || fetchError || !row) {
      return NextResponse.json(
        { error: "Tâche introuvable ou déjà traitée" },
        { status: 404 }
      );
    }
    if (row.status !== "pending") {
      return NextResponse.json(
        { error: "Tâche introuvable ou déjà traitée" },
        { status: 404 }
      );
    }

    assertOwnership(row, user.id);

    const { error: updateError } = await updateReviewStatus(
      sessionSupabase,
      row.id,
      "approved",
      { validated_by: user.id }
    );
    if (updateError) {
      console.error("[review/approve] Mise à jour statut échouée.");
      return NextResponse.json({ error: "Erreur lors de l'approbation" }, { status: 500 });
    }

    if (row.review_type === "legacy_action") {
      const indexError = await indexLegacyAgentAction(row, user.id);
      if (indexError) {
        console.error("[review/approve] Indexation RAG legacy échouée.");
        return NextResponse.json(
          { error: "Approuvé mais indexation RAG échouée" },
          { status: 500 }
        );
      }
    }

    const publishResult = await publishReview({
      row,
      reviewType: row.review_type,
      userId: user.id,
    });
    if (!publishResult.ok) {
      console.error("[review/approve] Publication hook échouée.");
      return NextResponse.json(
        { error: "Approuvé mais publication échouée" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, event_id: row.review_id, review_id: row.review_id });
  } catch (error) {
    return authErrorToResponse(error);
  }
}

/** POST /api/review/reject */
export async function handleReviewReject(request: Request): Promise<NextResponse> {
  let body: RejectReviewBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const reviewId = resolveReviewId(body);
  if (!reviewId) {
    return NextResponse.json({ error: "event_id requis" }, { status: 400 });
  }

  const rejectReason = body.rejection_reason ?? body.reason;

  try {
    const user = await requireAuthUserFromRequest(request);
    const sessionSupabase = createServerSupabaseClientFromRequest(request);

    const { data: row, error: fetchError, notFound } =
      await getReviewByReviewId(sessionSupabase, reviewId);

    if (notFound || fetchError || !row) {
      return NextResponse.json(
        { error: "Tâche introuvable ou déjà traitée" },
        { status: 404 }
      );
    }
    if (row.status !== "pending") {
      return NextResponse.json(
        { error: "Tâche introuvable ou déjà traitée" },
        { status: 404 }
      );
    }

    assertOwnership(row, user.id);

    const { error: updateError } = await updateReviewStatus(
      sessionSupabase,
      row.id,
      "rejected",
      {
        validated_by: user.id,
        rejection_reason: rejectReason ?? undefined,
      }
    );
    if (updateError) {
      console.error("[review/reject] Mise à jour statut échouée.");
      return NextResponse.json({ error: "Erreur lors du rejet" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, event_id: row.review_id, review_id: row.review_id });
  } catch (error) {
    return authErrorToResponse(error);
  }
}

/** GET /api/review/status?event_id=... */
export async function handleReviewStatus(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const reviewId = searchParams.get("review_id") ?? searchParams.get("event_id");

  if (!reviewId) {
    return NextResponse.json({ error: "event_id requis" }, { status: 400 });
  }

  try {
    const authUser = await getOptionalAuthUserFromRequest(request);

    if (authUser) {
      const sessionSupabase = createServerSupabaseClientFromRequest(request);
      const { data, error, notFound } = await getReviewByReviewId(sessionSupabase, reviewId);

      if (error) {
        console.error("[review/status] Erreur lecture (session).");
        return NextResponse.json({ error: "Erreur lors de la lecture" }, { status: 500 });
      }
      if (notFound || !data) {
        return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
      }

      return formatStatusResponse(data);
    }

    if (!verifyReviewPollingToken(request)) {
      return unauthorizedResponse();
    }

    const serviceSupabase = createServiceRoleSupabaseClient();
    if (!serviceSupabase) {
      console.error("[review/status] Configuration service_role manquante.");
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
    }

    const { data, error, notFound } = await getReviewByReviewId(serviceSupabase, reviewId);

    if (error) {
      console.error("[review/status] Erreur lecture (token).");
      return NextResponse.json({ error: "Erreur lors de la lecture" }, { status: 500 });
    }
    if (notFound || !data) {
      return NextResponse.json({
        event_id: reviewId,
        review_id: reviewId,
        status: "unknown",
        message: "Événement non trouvé dans la file de validation",
      });
    }

    return formatStatusResponse(data);
  } catch (error) {
    return authErrorToResponse(error);
  }
}

/** POST /api/tasks/validate — par id interne (task_id). */
export async function handleTaskValidate(request: Request): Promise<NextResponse> {
  let body: ValidateTaskBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { task_id, status, user_id: bodyUserId, rejection_reason } = body;
  if (!task_id || !status) {
    return NextResponse.json({ error: "task_id et status requis" }, { status: 400 });
  }
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status doit être approved ou rejected" }, { status: 400 });
  }

  try {
    const user = await requireAuthUserFromRequest(request);
    const sessionSupabase = createServerSupabaseClientFromRequest(request);

    const { data: row, error: fetchError } = await getReviewById(sessionSupabase, task_id);

    if (fetchError || !row) {
      return NextResponse.json(
        { error: "Tâche introuvable ou déjà traitée" },
        { status: 404 }
      );
    }
    if (row.status !== "pending") {
      return NextResponse.json(
        { error: "Tâche introuvable ou déjà traitée" },
        { status: 404 }
      );
    }

    if (bodyUserId && bodyUserId !== user.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }
    assertOwnership(row, user.id);

    const { error: updateError } = await updateReviewStatus(
      sessionSupabase,
      task_id,
      status,
      {
        validated_by: user.id,
        rejection_reason: status === "rejected" ? rejection_reason ?? undefined : undefined,
      }
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (status === "approved" && row.review_type === "legacy_action") {
      const indexError = await indexLegacyAgentAction(row, user.id);
      if (indexError) {
        console.error("[tasks/validate] agent_actions_index insert failed:", indexError.message);
        return NextResponse.json(
          { error: "Statut mis à jour mais indexation RAG échouée: " + indexError.message },
          { status: 500 }
        );
      }
      await publishReview({ row, reviewType: row.review_type, userId: user.id });
    }

    return NextResponse.json({ ok: true, task_id, status });
  } catch (error) {
    return authErrorToResponse(error);
  }
}

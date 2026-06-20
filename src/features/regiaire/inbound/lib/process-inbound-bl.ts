import "server-only";

import { createClient } from "@supabase/supabase-js";

import { parseBlDocument } from "@/features/regiaire/reception/parse-bl";
import { normalizeExtractedLine } from "@/features/regiaire/reception/validate-bl-line";
import { aggregateBlLines } from "@/features/regiaire/reception/delivery-access";
import { buildBlStoragePath, REGIAIRE_BL_BUCKET } from "@/lib/regiaire/constants";
import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";

export type InboundBLInput = {
  emailSlug: string;
  pdfBuffer: Buffer;
  filename: string;
  senderEmail: string;
  contentType?: string;
};

export type InboundBLResult =
  | {
      success: true;
      deliveryId: string;
      aireName: string;
      aireId: string;
      organizationId: string;
      lineCount: number;
      supplierName: string | null;
    }
  | { success: false; error: string };

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service_role non configuré.");
  return createClient<Database>(url, key);
}

/** Cherche un fournisseur par email exact ou par domaine expéditeur. */
async function matchSupplier(
  db: ReturnType<typeof forWrite>,
  organizationId: string,
  senderEmail: string
): Promise<{ id: string; name: string } | null> {
  const senderDomain = senderEmail.split("@")[1]?.toLowerCase();

  const { data } = await db
    .from("suppliers")
    .select("id, name, email")
    .eq("organization_id", organizationId);

  for (const s of data ?? []) {
    const supplierEmail = (s.email as string | null)?.toLowerCase();
    if (!supplierEmail) continue;
    if (supplierEmail === senderEmail.toLowerCase()) {
      return { id: s.id as string, name: s.name as string };
    }
    const supplierDomain = supplierEmail.split("@")[1];
    if (senderDomain && supplierDomain === senderDomain) {
      return { id: s.id as string, name: s.name as string };
    }
  }
  return null;
}

export async function processInboundBL(
  input: InboundBLInput
): Promise<InboundBLResult> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  // 1. Trouver l'aire par email_slug
  const { data: aire, error: aireError } = await db
    .from("aires")
    .select("id, organization_id, name")
    .eq("email_slug", input.emailSlug)
    .maybeSingle();

  if (aireError || !aire) {
    return { success: false, error: `Aire introuvable pour le slug "${input.emailSlug}"` };
  }

  const aireId = aire.id as string;
  const organizationId = aire.organization_id as string;
  const aireName = aire.name as string;

  // 2. Tenter de matcher un fournisseur
  const supplier = await matchSupplier(db, organizationId, input.senderEmail);

  // 3. Créer la livraison en draft
  const { data: delivery, error: deliveryError } = await db
    .from("deliveries")
    .insert({
      organization_id: organizationId,
      aire_id: aireId,
      supplier_id: supplier?.id ?? null,
      status: "draft",
      source: "email",
      inbound_sender_email: input.senderEmail,
    })
    .select("id")
    .single();

  if (deliveryError || !delivery) {
    return { success: false, error: deliveryError?.message ?? "Impossible de créer la livraison" };
  }

  const deliveryId = delivery.id as string;

  // 4. Upload PDF dans le bucket
  const storagePath = buildBlStoragePath(
    organizationId,
    deliveryId,
    input.filename
  );

  const { error: uploadError } = await admin.storage
    .from(REGIAIRE_BL_BUCKET)
    .upload(storagePath, input.pdfBuffer, {
      contentType: input.contentType ?? "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    // Nettoyer la livraison orpheline
    await db.from("deliveries").delete().eq("id", deliveryId);
    return { success: false, error: `Upload échoué : ${uploadError.message}` };
  }

  // 5. Extraction IA du BL
  let lineCount = 0;
  try {
    const extraction = await parseBlDocument(
      input.pdfBuffer,
      input.contentType ?? "application/pdf",
      input.filename
    );
    const normalized = extraction.lines.map(normalizeExtractedLine);
    const merged = aggregateBlLines(normalized);

    const lineRows = merged.map((line) => ({
      delivery_id: deliveryId,
      product_id: null as string | null,
      raw_name: line.raw_name,
      ean: line.ean ?? "",
      expected_qty: line.expected_qty ?? 0,
      scanned_qty: 0,
      dlc: line.dlc ?? null,
      needs_review: line.needs_review,
    }));

    if (lineRows.length > 0) {
      const { error: linesError } = await db
        .from("delivery_lines")
        .insert(lineRows);

      if (linesError) {
        return { success: false, error: linesError.message };
      }
    }

    lineCount = lineRows.length;
  } catch (err) {
    // L'extraction IA a échoué — la livraison reste en draft sans lignes,
    // l'opérateur devra relancer l'analyse manuellement.
    lineCount = 0;
  }

  // 6. Mettre à jour le chemin BL
  await db
    .from("deliveries")
    .update({ bl_file_path: storagePath })
    .eq("id", deliveryId);

  return {
    success: true,
    deliveryId,
    aireName,
    aireId,
    organizationId,
    lineCount,
    supplierName: supplier?.name ?? null,
  };
}

// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { processInboundBL } from "@/features/regiaire/inbound/lib/process-inbound-bl";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const AttachmentSchema = z.object({
  filename: z.string(),
  content: z.string(),
  contentType: z.string().optional(),
  mimeType: z.string().optional(),
});

const InboundPayloadSchema = z.object({
  from: z.string(),
  to: z.union([z.string(), z.array(z.string())]),
  subject: z.string().optional().default(""),
  attachments: z.array(AttachmentSchema).optional().default([]),
});

function extractSlug(toAddress: string, domain: string): string | null {
  const local = toAddress.split("@")[0]?.toLowerCase();
  const incomingDomain = toAddress.split("@")[1]?.toLowerCase();
  if (!local || !incomingDomain) return null;
  if (domain && incomingDomain !== domain.toLowerCase()) return null;
  return local;
}

function extractSenderEmail(from: string): string {
  // "Daunat <livraisons@daunat.fr>" → "livraisons@daunat.fr"
  const match = from.match(/<([^>]+)>/);
  return match ? match[1]!.toLowerCase() : from.trim().toLowerCase();
}

async function sendAck(params: {
  to: string;
  aireName: string;
  deliveryId: string;
  lineCount: number;
  supplierName: string | null;
  fromDomain: string;
}) {
  const fromEmail = params.fromDomain
    ? `noreply@${params.fromDomain}`
    : "noreply@regiaire.alphasys.tech";

  await getResend().emails.send({
    from: fromEmail,
    to: params.to,
    subject: `BL reçu — ${params.aireName}`,
    text: [
      `Votre bon de livraison a bien été reçu et intégré dans RégiAire.`,
      ``,
      `Aire     : ${params.aireName}`,
      params.supplierName ? `Fournisseur : ${params.supplierName}` : null,
      `Lignes détectées : ${params.lineCount > 0 ? params.lineCount : "en attente (l'IA n'a pas pu extraire les lignes)"}`,
      `Réf. livraison   : ${params.deliveryId}`,
      ``,
      `La livraison est en attente de validation par l'équipe terrain.`,
    ]
      .filter((l) => l !== null)
      .join("\n"),
  });
}

export async function POST(request: Request): Promise<Response> {
  // Vérification du secret partagé (query param ou header Authorization)
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expectedSecret = process.env.RESEND_INBOUND_SECRET;

  if (!expectedSecret) {
    console.error("[inbound-bl] RESEND_INBOUND_SECRET non configuré");
    return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 });
  }

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const domain = process.env.INBOUND_EMAIL_DOMAIN ?? "";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = InboundPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }

  const { from, to, attachments } = parsed.data;
  const senderEmail = extractSenderEmail(from);
  const toAddresses = Array.isArray(to) ? to : [to];

  // Trouver le slug depuis l'adresse destinataire
  let emailSlug: string | null = null;
  for (const addr of toAddresses) {
    const slug = extractSlug(addr, domain);
    if (slug) {
      emailSlug = slug;
      break;
    }
  }

  if (!emailSlug) {
    return NextResponse.json(
      { error: "Aucune adresse aire reconnue parmi les destinataires" },
      { status: 422 }
    );
  }

  // Trouver le premier PDF attaché
  const pdfAttachment = attachments.find((a) => {
    const ct = (a.contentType ?? a.mimeType ?? "").toLowerCase();
    const fn = a.filename.toLowerCase();
    return ct.includes("pdf") || fn.endsWith(".pdf");
  });

  if (!pdfAttachment) {
    return NextResponse.json(
      { error: "Aucune pièce jointe PDF trouvée dans l'email" },
      { status: 422 }
    );
  }

  const pdfBuffer = Buffer.from(pdfAttachment.content, "base64");

  const result = await processInboundBL({
    emailSlug,
    pdfBuffer,
    filename: pdfAttachment.filename,
    senderEmail,
    contentType: pdfAttachment.contentType ?? pdfAttachment.mimeType,
  });

  if (!result.success) {
    console.error("[inbound-bl] Erreur traitement :", result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Accusé de réception au fournisseur
  if (process.env.RESEND_API_KEY) {
    try {
      await sendAck({
        to: senderEmail,
        aireName: result.aireName,
        deliveryId: result.deliveryId,
        lineCount: result.lineCount,
        supplierName: result.supplierName,
        fromDomain: domain,
      });
    } catch (err) {
      // L'ACK est best-effort — on ne bloque pas si Resend échoue
      console.warn("[inbound-bl] ACK non envoyé :", err);
    }
  }

  return NextResponse.json({
    success: true,
    deliveryId: result.deliveryId,
    aireName: result.aireName,
    lineCount: result.lineCount,
  });
}

import {
  formatEanForReport,
  type DiscrepancyLine,
  type UnexpectedLine,
} from "@/features/regiaire/reception/schemas";

export function buildDeliveryReportFromLines(
  lines: Array<{
    ean: string | null;
    raw_name: string;
    expected_qty: number;
    scanned_qty: number;
  }>
): {
  discrepancies: DiscrepancyLine[];
  unexpected: UnexpectedLine[];
} {
  const discrepancies: DiscrepancyLine[] = [];
  const unexpected: UnexpectedLine[] = [];

  for (const line of lines) {
    if (line.expected_qty === 0 && line.scanned_qty > 0) {
      if (!line.ean) continue;
      unexpected.push({
        ean: line.ean,
        rawName: line.raw_name,
        scannedQty: line.scanned_qty,
      });
      continue;
    }

    if (line.scanned_qty < line.expected_qty) {
      discrepancies.push({
        ean: line.ean,
        rawName: line.raw_name,
        expectedQty: line.expected_qty,
        scannedQty: line.scanned_qty,
        kind: "missing",
      });
    } else if (line.scanned_qty > line.expected_qty) {
      discrepancies.push({
        ean: line.ean,
        rawName: line.raw_name,
        expectedQty: line.expected_qty,
        scannedQty: line.scanned_qty,
        kind: "surplus",
      });
    }
  }

  return { discrepancies, unexpected };
}

export function discrepancyDeltaQty(line: DiscrepancyLine): number {
  return Math.abs(line.expectedQty - line.scannedQty);
}

export function formatDiscrepancyDelta(line: DiscrepancyLine): string {
  const delta = discrepancyDeltaQty(line);
  if (line.kind === "missing") {
    return `Manque ${delta} unité${delta > 1 ? "s" : ""}`;
  }
  return `Surplus de ${delta} unité${delta > 1 ? "s" : ""}`;
}

export function buildSupplierEmailDraft(params: {
  supplierName: string;
  supplierEmail: string | null;
  deliveryId: string;
  discrepancies: DiscrepancyLine[];
  unexpected: UnexpectedLine[];
}): { to: string | null; subject: string; body: string } {
  const missing = params.discrepancies.filter((d) => d.kind === "missing");
  const surplus = params.discrepancies.filter((d) => d.kind === "surplus");

  const lines: string[] = [
    `Bonjour,`,
    ``,
    `Suite à la réception du bon de livraison (réf. ${params.deliveryId}), nous constatons les écarts suivants :`,
    ``,
  ];

  if (missing.length > 0) {
    lines.push(`--- Manquants ---`);
    for (const row of missing) {
      const delta = discrepancyDeltaQty(row);
      lines.push(
        `• ${row.rawName} (EAN ${formatEanForReport(row.ean)}) : attendu ${row.expectedQty}, reçu ${row.scannedQty} (−${delta})`
      );
    }
    lines.push(``);
  }

  if (surplus.length > 0) {
    lines.push(`--- Surplus (BL) ---`);
    for (const row of surplus) {
      const delta = discrepancyDeltaQty(row);
      lines.push(
        `• ${row.rawName} (EAN ${formatEanForReport(row.ean)}) : attendu ${row.expectedQty}, reçu ${row.scannedQty} (+${delta})`
      );
    }
    lines.push(``);
  }

  if (params.unexpected.length > 0) {
    lines.push(`--- Produits non prévus au BL ---`);
    for (const row of params.unexpected) {
      lines.push(`• ${row.rawName} (EAN ${row.ean}) : ${row.scannedQty} unité(s) reçue(s)`);
    }
    lines.push(``);
  }

  lines.push(
    `Merci de nous confirmer les actions correctives.`,
    ``,
    `Cordialement,`,
    `Réception ${params.supplierName}`
  );

  return {
    to: params.supplierEmail,
    subject: `Écart de livraison — BL ${params.deliveryId.slice(0, 8)}`,
    body: lines.join("\n"),
  };
}

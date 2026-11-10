// Copyright © 2026 OrbitSys. Tous droits réservés.

/**
 * Génération PDF côté client pour devis/factures Orbit Artisan.
 * Uniquement du texte issu des données de l'application (aucune ressource
 * externe chargée) — la surface de la CVE jsPDF (chargement de fichiers par
 * chemin) n'est pas atteinte ici.
 */

export type PdfLine = {
  label: string;
  detail?: string | null;
  totalCents: number;
};

export type PdfDocument = {
  kind: "Devis" | "Facture";
  number?: string | null;
  businessName: string;
  customerName?: string | null;
  customerEmail?: string | null;
  date: string; // ISO
  labor: PdfLine[];
  materials: PdfLine[];
  laborTotalCents: number;
  materialsTotalCents: number;
  grandTotalCents: number;
  notes?: string | null;
};

const eur = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export async function downloadArtisanPdf(doc: PdfDocument): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });

  const left = 20;
  const right = 190;
  let y = 22;

  // En-tête entreprise
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(doc.businessName || "—", left, y);

  pdf.setFontSize(20);
  pdf.text(doc.kind.toUpperCase(), right, y, { align: "right" });
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(110);
  if (doc.number) pdf.text(`N° ${doc.number}`, right, y, { align: "right" });
  pdf.text(new Date(doc.date).toLocaleDateString("fr-FR"), right, y + 5, { align: "right" });

  // Client
  if (doc.customerName || doc.customerEmail) {
    pdf.setTextColor(30);
    pdf.setFont("helvetica", "bold");
    pdf.text("Client", left, y + 2);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(80);
    if (doc.customerName) pdf.text(doc.customerName, left, y + 7);
    if (doc.customerEmail) pdf.text(doc.customerEmail, left, y + 12);
  }
  y += 24;

  pdf.setDrawColor(210);
  pdf.line(left, y, right, y);
  y += 8;

  const section = (title: string, lines: PdfLine[]) => {
    if (lines.length === 0) return;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(30);
    pdf.text(title, left, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    for (const l of lines) {
      if (y > 265) {
        pdf.addPage();
        y = 22;
      }
      const label = l.detail ? `${l.label} — ${l.detail}` : l.label;
      pdf.setTextColor(70);
      pdf.text(label, left, y, { maxWidth: 130 });
      pdf.setTextColor(30);
      pdf.text(eur(l.totalCents), right, y, { align: "right" });
      y += 7;
    }
    y += 3;
  };

  section("Main-d'œuvre", doc.labor);
  section("Matériaux", doc.materials);

  // Totaux
  y += 2;
  pdf.setDrawColor(210);
  pdf.line(120, y, right, y);
  y += 7;
  pdf.setFontSize(10);
  pdf.setTextColor(90);
  pdf.text("Main-d'œuvre", 120, y);
  pdf.text(eur(doc.laborTotalCents), right, y, { align: "right" });
  y += 6;
  pdf.text("Matériaux", 120, y);
  pdf.text(eur(doc.materialsTotalCents), right, y, { align: "right" });
  y += 8;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(20);
  pdf.text("Total", 120, y);
  pdf.text(eur(doc.grandTotalCents), right, y, { align: "right" });

  if (doc.notes) {
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(110);
    pdf.text(doc.notes, left, y, { maxWidth: right - left });
  }

  const fileName = `${doc.kind}-${doc.number ?? new Date(doc.date).toISOString().slice(0, 10)}.pdf`;
  pdf.save(fileName);
}

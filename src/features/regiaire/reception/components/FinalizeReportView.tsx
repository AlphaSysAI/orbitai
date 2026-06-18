"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Mail, AlertTriangle, Minus, Plus } from "lucide-react";

import { useRegiaireAireId } from "@/features/regiaire/hooks/useRegiaireAireId";
import type { FinalizeDeliveryReport } from "@/features/regiaire/reception/schemas";
import { formatEanForReport } from "@/features/regiaire/reception/schemas";
import {
  discrepancyDeltaQty,
  formatDiscrepancyDelta,
} from "@/features/regiaire/reception/delivery-report";

export function FinalizeReportView({
  report,
  supplierName,
}: {
  report: FinalizeDeliveryReport;
  supplierName?: string;
}) {
  const aireId = useRegiaireAireId();
  const [emailTo, setEmailTo] = useState(report.draftEmail?.to ?? "");
  const [emailSubject, setEmailSubject] = useState(
    report.draftEmail?.subject ?? ""
  );
  const [emailBody, setEmailBody] = useState(report.draftEmail?.body ?? "");
  const [copied, setCopied] = useState<string | null>(null);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);

  const copyText = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const mailtoHref =
    emailTo.trim() && emailSubject
      ? `mailto:${encodeURIComponent(emailTo.trim())}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
      : undefined;

  const handleSendEmail = () => {
    if (!mailtoHref) {
      setEmailFeedback("Renseignez l'adresse email du fournisseur.");
      return;
    }

    setEmailFeedback(null);
    window.location.href = mailtoHref;
  };

  const isDiscrepancy = report.status === "discrepancy";
  const hasEmailContent =
    isDiscrepancy &&
    (report.discrepancies.length > 0 || report.unexpected.length > 0);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div
        className={`rounded-2xl border p-5 ${
          isDiscrepancy
            ? "border-orange-500/40 bg-orange-600/10"
            : "border-emerald-500/40 bg-emerald-600/10"
        }`}
      >
        <div className="flex items-center gap-3">
          {isDiscrepancy ? (
            <AlertTriangle className="text-orange-400" size={28} />
          ) : (
            <CheckCircle2 className="text-emerald-400" size={28} />
          )}
          <div>
            <h1 className="text-xl font-bold text-white">
              {isDiscrepancy ? "Réception avec écarts" : "Réception terminée"}
            </h1>
            {supplierName && (
              <p className="text-sm text-slate-400">{supplierName}</p>
            )}
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-300">
          <strong className="text-white">{report.batchesCreated}</strong> lot(s)
          entrés en stock
          {isDiscrepancy && " malgré les écarts constatés"}.
        </p>
      </div>

      {report.discrepancies.length > 0 && (
        <ReportSection title="Écarts par produit (BL)">
          <ul className="space-y-3">
            {report.discrepancies.map((d) => {
              const delta = discrepancyDeltaQty(d);
              const isMissing = d.kind === "missing";
              return (
                <li
                  key={`${d.ean ?? d.rawName}-${d.kind}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">{d.rawName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        EAN {formatEanForReport(d.ean)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
                        isMissing
                          ? "bg-red-500/15 text-red-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {isMissing ? (
                        <Minus size={12} />
                      ) : (
                        <Plus size={12} />
                      )}
                      {formatDiscrepancyDelta(d)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">
                    Attendu <span className="text-white">{d.expectedQty}</span>
                    {" · "}
                    Scanné <span className="text-white">{d.scannedQty}</span>
                    {" · "}
                    Écart{" "}
                    <span className={isMissing ? "text-red-300" : "text-amber-300"}>
                      {isMissing ? "−" : "+"}
                      {delta}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </ReportSection>
      )}

      {report.unexpected.length > 0 && (
        <ReportSection title="Produits non prévus au BL">
          <ul className="space-y-3">
            {report.unexpected.map((u) => (
              <li
                key={u.ean}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
              >
                <p className="font-medium text-white">{u.rawName}</p>
                <p className="mt-1 text-xs text-slate-500">EAN {u.ean}</p>
                <p className="mt-3 text-sm text-amber-300">
                  {u.scannedQty} unité{u.scannedQty > 1 ? "s" : ""} reçue
                  {u.scannedQty > 1 ? "s" : ""} hors BL
                </p>
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {hasEmailContent && (
        <ReportSection title="Email fournisseur">
          <p className="mb-4 text-xs text-slate-500">
            Vous pouvez renvoyer cet email à tout moment en rouvrant la livraison
            depuis la liste.
          </p>
          <div className="space-y-3">
            <Field label="Destinataire">
              <input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                placeholder="email@fournisseur.com"
              />
            </Field>
            <Field label="Objet">
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </Field>
            <Field label="Corps">
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </Field>

            {emailFeedback && (
              <p className="text-sm text-amber-300">{emailFeedback}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSendEmail}
                className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs font-bold uppercase text-white hover:bg-amber-500"
              >
                <Mail size={14} />
                Envoyer email au fournisseur
              </button>
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    "email",
                    `To: ${emailTo}\nSubject: ${emailSubject}\n\n${emailBody}`
                  )
                }
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-xs font-bold uppercase text-slate-200"
              >
                <Copy size={14} />
                {copied === "email" ? "Copié !" : "Copier le contenu"}
              </button>
            </div>
          </div>
        </ReportSection>
      )}

      <Link
        href={`/station/${aireId}/deliveries`}
        className="block w-full rounded-xl border border-slate-700 py-3 text-center text-sm font-bold text-slate-300 hover:bg-slate-800"
      >
        Retour aux réceptions
      </Link>
    </div>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

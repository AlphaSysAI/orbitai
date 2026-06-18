"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Mail, AlertTriangle } from "lucide-react";

import type { FinalizeDeliveryReport } from "@/features/regiaire/reception/schemas";

export function FinalizeReportView({
  report,
  supplierName,
}: {
  report: FinalizeDeliveryReport;
  supplierName?: string;
}) {
  const [emailTo, setEmailTo] = useState(report.draftEmail?.to ?? "");
  const [emailSubject, setEmailSubject] = useState(
    report.draftEmail?.subject ?? ""
  );
  const [emailBody, setEmailBody] = useState(report.draftEmail?.body ?? "");
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const mailtoHref =
    emailTo && emailSubject
      ? `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
      : undefined;

  const isDiscrepancy = report.status === "discrepancy";

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
        <ReportSection title="Manquants / surplus (BL)">
          <ul className="space-y-2 text-sm">
            {report.discrepancies.map((d) => (
              <li key={`${d.ean}-${d.kind}`} className="text-slate-300">
                <span className="text-white">{d.rawName}</span> ({d.ean}) —{" "}
                {d.kind === "missing" ? "manque" : "surplus"} : attendu{" "}
                {d.expectedQty}, scanné {d.scannedQty}
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {report.unexpected.length > 0 && (
        <ReportSection title="Produits non prévus au BL">
          <ul className="space-y-2 text-sm">
            {report.unexpected.map((u) => (
              <li key={u.ean} className="text-slate-300">
                <span className="text-white">{u.rawName}</span> ({u.ean}) —{" "}
                {u.scannedQty} scanné(s)
              </li>
            ))}
          </ul>
        </ReportSection>
      )}

      {isDiscrepancy && report.draftEmail && (
        <ReportSection title="Brouillon email fournisseur">
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    "email",
                    `To: ${emailTo}\nSubject: ${emailSubject}\n\n${emailBody}`
                  )
                }
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold uppercase text-slate-200"
              >
                <Copy size={14} />
                {copied === "email" ? "Copié !" : "Copier"}
              </button>
              {mailtoHref && (
                <a
                  href={mailtoHref}
                  className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold uppercase text-white"
                >
                  <Mail size={14} />
                  Ouvrir messagerie
                </a>
              )}
            </div>
          </div>
        </ReportSection>
      )}

      <Link
        href="/station/deliveries"
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

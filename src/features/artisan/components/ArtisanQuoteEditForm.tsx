// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useState } from "react";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";

import { updateQuoteContent, type QuoteDetail } from "@/features/artisan/quotes/actions";

type LaborRow = { label: string; hours: string; rate: string };
type MaterialRow = { label: string; quantity: string; unitPrice: string };

const num = (s: string) => {
  const n = Number.parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600";

export function ArtisanQuoteEditForm({
  quote,
  onSaved,
  onCancel,
}: {
  quote: QuoteDetail;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [customerName, setCustomerName] = useState(quote.customerName ?? "");
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [labor, setLabor] = useState<LaborRow[]>(
    quote.services.map((s) => ({
      label: s.label,
      hours: String(Math.round((s.durationMinutes / 60) * 100) / 100),
      rate: String((s.unitPriceCents ?? 0) / 100),
    }))
  );
  const [materials, setMaterials] = useState<MaterialRow[]>(
    quote.materials.map((m) => ({
      label: m.label,
      quantity: String(m.quantity),
      unitPrice: String(m.unitPriceCents / 100),
    }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const laborTotal = labor.reduce((s, l) => s + num(l.hours) * num(l.rate), 0);
  const materialsTotal = materials.reduce((s, m) => s + num(m.quantity) * num(m.unitPrice), 0);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    const result = await updateQuoteContent(quote.id, {
      customerName: customerName.trim() || null,
      notes: notes.trim() || null,
      labor: labor.map((l) => ({ label: l.label, hours: num(l.hours), hourlyRateEur: num(l.rate) })),
      materials: materials.map((m) => ({
        label: m.label,
        quantity: num(m.quantity),
        unitPriceEur: num(m.unitPrice),
      })),
    });
    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved();
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Client</span>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
        </label>
      </div>

      {/* Main-d'œuvre */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Main-d&apos;œuvre</p>
        {labor.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_80px_auto] items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => setLabor((p) => p.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
              placeholder="Prestation"
              className={inputClass}
            />
            <input
              value={row.hours}
              onChange={(e) => setLabor((p) => p.map((r, j) => (j === i ? { ...r, hours: e.target.value } : r)))}
              placeholder="h"
              inputMode="decimal"
              className={inputClass}
            />
            <input
              value={row.rate}
              onChange={(e) => setLabor((p) => p.map((r, j) => (j === i ? { ...r, rate: e.target.value } : r)))}
              placeholder="€/h"
              inputMode="decimal"
              className={inputClass}
            />
            <button type="button" onClick={() => setLabor((p) => p.filter((_, j) => j !== i))} className="p-2 text-slate-500 hover:text-red-400">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLabor((p) => [...p, { label: "", hours: "1", rate: "" }])}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-orange-300"
        >
          <Plus size={12} /> Ligne main-d&apos;œuvre
        </button>
      </div>

      {/* Matériaux */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Matériaux</p>
        {materials.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_80px_auto] items-center gap-2">
            <input
              value={row.label}
              onChange={(e) => setMaterials((p) => p.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
              placeholder="Matériau"
              className={inputClass}
            />
            <input
              value={row.quantity}
              onChange={(e) => setMaterials((p) => p.map((r, j) => (j === i ? { ...r, quantity: e.target.value } : r)))}
              placeholder="Qté"
              inputMode="decimal"
              className={inputClass}
            />
            <input
              value={row.unitPrice}
              onChange={(e) => setMaterials((p) => p.map((r, j) => (j === i ? { ...r, unitPrice: e.target.value } : r)))}
              placeholder="€"
              inputMode="decimal"
              className={inputClass}
            />
            <button type="button" onClick={() => setMaterials((p) => p.filter((_, j) => j !== i))} className="p-2 text-slate-500 hover:text-red-400">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setMaterials((p) => [...p, { label: "", quantity: "1", unitPrice: "" }])}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-orange-300"
        >
          <Plus size={12} /> Ligne matériau
        </button>
      </div>

      <label className="block space-y-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
      </label>

      <div className="flex flex-col gap-1 border-t border-slate-800 pt-4 text-sm">
        <div className="flex justify-between text-slate-400">
          <span>Total estimé</span>
          <strong className="text-white">{eur(laborTotal + materialsTotal)}</strong>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-slate-600"
        >
          <X size={14} /> Annuler
        </button>
      </div>
    </div>
  );
}

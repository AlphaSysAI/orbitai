// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Receipt } from "lucide-react";

import { getCityTaxConfig, updateCityTaxConfig } from "@/features/hotel/billing/actions";
import { getHotelVoiceNumber, setHotelVoiceNumber } from "@/features/voice/actions";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 placeholder:text-slate-600";

export function HotelSettings() {
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("");
  const [exemptChildren, setExemptChildren] = useState(true);
  const [maxNights, setMaxNights] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [voicePhone, setVoicePhone] = useState("");
  const [savingVoice, setSavingVoice] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [result, voiceRes] = await Promise.all([getCityTaxConfig(), getHotelVoiceNumber()]);
    setIsLoading(false);
    if (voiceRes.success) setVoicePhone(voiceRes.data.phone ?? "");
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEnabled(result.data.enabled);
    setAmount(result.data.amountPerPersonNightCents ? String(result.data.amountPerPersonNightCents / 100) : "");
    setExemptChildren(result.data.exemptChildren);
    setMaxNights(result.data.maxNights ? String(result.data.maxNights) : "");
  }, []);

  const saveVoice = async () => {
    setSavingVoice(true);
    setError(null);
    setSuccess(null);
    const result = await setHotelVoiceNumber(voicePhone.trim());
    setSavingVoice(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccess("Numéro de l'assistant vocal enregistré.");
  };

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    const result = await updateCityTaxConfig({
      enabled,
      amountPerPersonNightEur: Number.parseFloat(amount.replace(",", ".")) || 0,
      exemptChildren,
      maxNights: maxNights ? Number.parseInt(maxNights, 10) : null,
    });
    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccess("Réglages enregistrés.");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-sky-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          <Receipt size={26} className="text-sky-400" />
          Réglages
        </h2>
        <p className="mt-2 text-sm text-slate-400">Taxe de séjour appliquée aux factures.</p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-5">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">Taxe de séjour</h3>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-600"
          />
          Activer la taxe de séjour
        </label>

        {enabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Montant / personne / nuit (€)
              </span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="1,50" className={inputClass} />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Plafond de nuits (optionnel)
              </span>
              <input type="number" min={1} value={maxNights} onChange={(e) => setMaxNights(e.target.value)} placeholder="7" className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={exemptChildren}
                onChange={(e) => setExemptChildren(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-600"
              />
              Exonérer les enfants
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving}
          className="rounded-xl bg-sky-600 px-6 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">Assistant vocal IA</h3>
        <p className="text-xs text-slate-500">
          Numéro de téléphone dédié à votre assistant vocal (format international). Les appels
          reçus sur ce numéro seront rattachés à votre établissement.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Numéro de l&apos;assistant
            </span>
            <input
              value={voicePhone}
              onChange={(e) => setVoicePhone(e.target.value)}
              placeholder="+33 1 23 45 67 89"
              className={`${inputClass} w-56`}
            />
          </label>
          <button
            type="button"
            onClick={() => void saveVoice()}
            disabled={savingVoice}
            className="rounded-xl bg-sky-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {savingVoice ? "…" : "Enregistrer"}
          </button>
        </div>
      </section>
    </div>
  );
}

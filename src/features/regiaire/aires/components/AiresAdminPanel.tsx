"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Save } from "lucide-react";

import {
  createAire,
  listAiresForOrg,
  updateAire,
} from "@/features/regiaire/aires/actions";
import type { AireInput, AireListItem } from "@/features/regiaire/aires/schemas";
import {
  BISON_FUTE_ZONE_LABELS,
  BISON_FUTE_ZONES,
  type BisonFuteZone,
} from "@/features/regiaire/verdict/bison-fute/schemas";
import type { SchoolZone } from "@/features/regiaire/verdict/schemas";

const SCHOOL_ZONES: SchoolZone[] = ["A", "B", "C"];
const WEEKDAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

const EMPTY_FORM: AireInput = {
  name: "",
  city: "",
  lat: 48.8566,
  lon: 2.3522,
  schoolZone: "C",
  orderDays: [1, 2, 3, 4, 5],
  bisonFuteZone: 5,
};

export function AiresAdminPanel() {
  const [aires, setAires] = useState<AireListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<AireInput>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await listAiresForOrg();
    if (!result.success) {
      setError(result.error);
    } else {
      setAires(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setSelectedId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    const result = selectedId
      ? await updateAire(selectedId, form)
      : await createAire(form);

    setIsSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    resetForm();
    await load();
  };

  const toggleOrderDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      orderDays: prev.orderDays.includes(day)
        ? prev.orderDays.filter((d) => d !== day)
        : [...prev.orderDays, day].sort((a, b) => a - b),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link
        href="/station"
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300"
      >
        <ArrowLeft size={14} />
        Mes aires
      </Link>

      <header>
        <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
          Administration des aires
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Créez et configurez les aires de votre organisation.
        </p>
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {aires.map((aire) => (
          <li key={aire.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedId(aire.id);
                setForm({
                  name: aire.name,
                  city: aire.city ?? "",
                  lat: 48.8566,
                  lon: 2.3522,
                  schoolZone: aire.schoolZone,
                  orderDays: [1, 2, 3, 4, 5],
                  bisonFuteZone: aire.bisonFuteZone ?? null,
                });
              }}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedId === aire.id
                  ? "border-amber-500/40 bg-amber-600/10"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <p className="font-medium text-white">{aire.name}</p>
              <p className="text-xs text-slate-500">
                {aire.city ?? "Ville non renseignée"} · zone {aire.schoolZone}
                {aire.bisonFuteZone != null && ` · BF ${aire.bisonFuteZone}`}
              </p>
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {selectedId ? "Modifier l'aire" : "Nouvelle aire"}
          </p>
          {selectedId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-[10px] font-bold uppercase text-slate-500 hover:text-slate-300"
            >
              Annuler
            </button>
          )}
        </div>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Nom
          </span>
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Ville
          </span>
          <input
            value={form.city ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Latitude
            </span>
            <input
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, lat: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Longitude
            </span>
            <input
              type="number"
              step="any"
              value={form.lon}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, lon: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            />
          </label>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Zone Bison Futé
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, bisonFuteZone: null }))}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${
                form.bisonFuteZone == null
                  ? "bg-amber-600/30 text-amber-400 border border-amber-500/40"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              —
            </button>
            {BISON_FUTE_ZONES.map((zone) => (
              <button
                key={zone}
                type="button"
                title={BISON_FUTE_ZONE_LABELS[zone]}
                onClick={() => setForm((prev) => ({ ...prev, bisonFuteZone: zone }))}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                  form.bisonFuteZone === zone
                    ? "bg-amber-600/30 text-amber-400 border border-amber-500/40"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {zone}
              </button>
            ))}
          </div>
          {form.bisonFuteZone != null && (
            <p className="mt-1 text-[10px] text-slate-500">
              {BISON_FUTE_ZONE_LABELS[form.bisonFuteZone as BisonFuteZone]}
            </p>
          )}
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Zone vacances scolaires
          </span>
          <div className="mt-2 flex gap-2">
            {SCHOOL_ZONES.map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, schoolZone: zone }))}
                className={`rounded-lg px-3 py-1 text-xs font-bold uppercase ${
                  form.schoolZone === zone
                    ? "bg-amber-600 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {zone}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Jours de commande
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleOrderDay(day.value)}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${
                  form.orderDays.includes(day.value)
                    ? "bg-amber-600/30 text-amber-400 border border-amber-500/40"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || !form.name.trim() || form.orderDays.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : selectedId ? (
            <Save size={16} />
          ) : (
            <Plus size={16} />
          )}
          {selectedId ? "Enregistrer" : "Créer l'aire"}
        </button>
      </div>
    </div>
  );
}

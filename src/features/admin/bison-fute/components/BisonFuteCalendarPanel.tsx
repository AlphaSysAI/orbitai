"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import {
  bulkImportBisonFute,
  deleteBisonFuteDay,
  getBisonFuteDay,
  listBisonFuteDays,
  upsertBisonFuteDay,
} from "@/features/admin/bison-fute/actions";
import { BisonFuteDayEditor } from "@/features/admin/bison-fute/components/BisonFuteDayEditor";
import {
  BISON_FUTE_ENCODING_HELP,
  BisonFuteLevelPill,
} from "@/features/admin/bison-fute/components/BisonFuteLevelPill";
import type {
  BisonFuteDaySummary,
  UpsertBisonFuteDayInput,
} from "@/features/admin/bison-fute/schemas";
import { BISON_FUTE_ZONES } from "@/features/regiaire/verdict/bison-fute/schemas";

const CURRENT_YEAR = new Date().getFullYear();

export function BisonFuteCalendarPanel() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [days, setDays] = useState<BisonFuteDaySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorInitial, setEditorInitial] = useState<UpsertBisonFuteDayInput | null>(
    null
  );
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await listBisonFuteDays(year);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      setDays([]);
      return;
    }
    setDays(result.data);
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditorInitial({
      date: `${year}-01-01`,
      aller: { mode: "quick", nationalLevel: "vert" },
      retour: { mode: "quick", nationalLevel: "vert" },
    });
    setEditorOpen(true);
  };

  const openEdit = async (day: BisonFuteDaySummary) => {
    const result = await getBisonFuteDay(day.date);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEditorInitial(result.data.editor);
    setEditorOpen(true);
  };

  const handleDelete = async (date: string) => {
    if (!confirm(`Supprimer les prévisions du ${date} ?`)) return;
    const result = await deleteBisonFuteDay(date);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await load();
  };

  const handleSave = async (input: UpsertBisonFuteDayInput) => {
    const result = await upsertBisonFuteDay(input);
    if (!result.success) {
      return result.error;
    }
    setEditorOpen(false);
    await load();
    return null;
  };

  const handleBulkImport = async () => {
    setIsImporting(true);
    setBulkResult(null);
    setError(null);
    const result = await bulkImportBisonFute(bulkText);
    setIsImporting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setBulkResult(
      `${result.data.dates} jour(s), ${result.data.rowsUpserted} ligne(s) enregistrée(s).`
    );
    setBulkText("");
    await load();
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-violet-400">
            <Calendar size={18} />
            <span className="text-[10px] font-black uppercase tracking-wider">
              Référence nationale
            </span>
          </div>
          <h2 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
            Calendrier Bison Futé
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Jours colorés partagés par toutes les organisations. Donnée
            nationale — écriture réservée aux admins plateforme (service_role).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Année
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500"
          >
            <Plus size={14} />
            Ajouter un jour
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h3 className="mb-4 text-[10px] font-black uppercase tracking-wider text-slate-500">
          Jours saisis ({year})
        </h3>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Chargement…
          </div>
        ) : days.length === 0 ? (
          <p className="py-8 text-sm text-slate-500">
            Aucun jour pour cette année. Ajoutez une date ou importez en masse.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Aller</th>
                  <th className="pb-3 pr-4">Retour</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {days.map((day) => (
                  <tr key={day.date} className="align-middle">
                    <td className="py-3 pr-4 font-mono text-white">{day.date}</td>
                    <td className="py-3 pr-4">
                      <ZonePills levels={day.aller} />
                    </td>
                    <td className="py-3 pr-4">
                      <ZonePills levels={day.retour} />
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => void openEdit(day)}
                          className="rounded-lg border border-slate-700 px-3 py-1 text-[10px] font-bold uppercase text-slate-300 hover:border-violet-500/50"
                        >
                          Éditer
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(day.date)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-300">
          <Upload size={16} />
          <h3 className="text-sm font-black uppercase tracking-wider">
            Import en masse
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Collez des lignes <code className="text-slate-400">date,aller,retour</code>{" "}
          (dates DD/MM/YY). En-tête optionnel. {BISON_FUTE_ENCODING_HELP}
        </p>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={8}
          placeholder={`date,aller,retour\n30/07/26,N,O6R\n01/08/26,R,R`}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-xs text-white placeholder:text-slate-600"
        />
        {bulkResult && (
          <p className="text-sm text-emerald-400">{bulkResult}</p>
        )}
        <button
          type="button"
          disabled={isImporting || bulkText.trim().length === 0}
          onClick={() => void handleBulkImport()}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {isImporting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} />
          )}
          Importer
        </button>
      </section>

      {editorOpen && editorInitial && (
        <BisonFuteDayEditor
          initial={editorInitial}
          onClose={() => setEditorOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function ZonePills({
  levels,
}: {
  levels: BisonFuteDaySummary["aller"];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {BISON_FUTE_ZONES.map((zone) => (
        <BisonFuteLevelPill
          key={zone}
          zone={zone}
          level={levels[zone]}
          compact
        />
      ))}
    </div>
  );
}

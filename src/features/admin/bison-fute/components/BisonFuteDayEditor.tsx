"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

import {
  BISON_FUTE_ENCODING_HELP,
} from "@/features/admin/bison-fute/components/BisonFuteLevelPill";
import type {
  DirectionInput,
  UpsertBisonFuteDayInput,
} from "@/features/admin/bison-fute/schemas";
import {
  BISON_FUTE_LEVEL_LABELS,
  BISON_FUTE_ZONES,
  type BisonFuteLevel,
  type BisonFuteZone,
} from "@/features/regiaire/verdict/bison-fute/schemas";
import { bisonFuteBadgeClass } from "@/features/regiaire/verdict/lib/bison-fute-display";

type BisonFuteDayEditorProps = {
  initial: UpsertBisonFuteDayInput;
  onClose: () => void;
  onSave: (input: UpsertBisonFuteDayInput) => Promise<string | null>;
};

const LEVELS: BisonFuteLevel[] = ["vert", "orange", "rouge", "noir"];

export function BisonFuteDayEditor({
  initial,
  onClose,
  onSave,
}: BisonFuteDayEditorProps) {
  const [date, setDate] = useState(initial.date);
  const [aller, setAller] = useState<DirectionInput>(initial.aller);
  const [retour, setRetour] = useState<DirectionInput>(initial.retour);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    setIsSaving(true);
    setError(null);
    const err = await onSave({ date, aller, retour });
    setIsSaving(false);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-[#0f172a] p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Jour Bison Futé</h3>
            <p className="mt-1 text-xs text-slate-500">
              6 zones × aller / retour — zones non précisées = vert
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <label className="mb-6 block">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
          />
        </label>

        <DirectionEditor
          label="Aller"
          value={aller}
          onChange={setAller}
        />
        <DirectionEditor
          label="Retour"
          value={retour}
          onChange={setRetour}
        />

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-[10px] font-bold uppercase text-slate-400"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function DirectionEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DirectionInput;
  onChange: (v: DirectionInput) => void;
}) {
  return (
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-violet-400">
        {label}
      </p>

      <div className="mb-4 flex gap-2">
        {(["quick", "code"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() =>
              onChange(
                mode === "quick"
                  ? { mode: "quick", nationalLevel: "vert" }
                  : { mode: "code", encoding: "" }
              )
            }
            className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase ${
              value.mode === mode
                ? "bg-violet-600 text-white"
                : "bg-slate-800 text-slate-500"
            }`}
          >
            {mode === "quick" ? "Rapide" : "Code Bison Futé"}
          </button>
        ))}
      </div>

      {value.mode === "quick" ? (
        <QuickDirectionForm value={value} onChange={onChange} />
      ) : (
        <CodeDirectionForm value={value} onChange={onChange} />
      )}
    </div>
  );
}

function QuickDirectionForm({
  value,
  onChange,
}: {
  value: Extract<DirectionInput, { mode: "quick" }>;
  onChange: (v: DirectionInput) => void;
}) {
  const overrides = value.zoneOverrides ?? {};

  const setNational = (nationalLevel: BisonFuteLevel) => {
    onChange({ ...value, nationalLevel, zoneOverrides: undefined });
  };

  const setZoneOverride = (zone: BisonFuteZone, level: BisonFuteLevel | null) => {
    const next = { ...overrides };
    if (level == null || level === value.nationalLevel) {
      delete next[zone];
    } else {
      next[zone] = level;
    }
    onChange({
      ...value,
      zoneOverrides: Object.keys(next).length > 0 ? next : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">
          Niveau national
        </p>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setNational(level)}
              className={`rounded-lg border px-3 py-1 text-[10px] font-bold uppercase ${bisonFuteBadgeClass(level)} ${
                value.nationalLevel === level ? "ring-2 ring-violet-500" : ""
              }`}
            >
              {BISON_FUTE_LEVEL_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">
          Surcharges par zone (optionnel)
        </p>
        <div className="space-y-2">
          {BISON_FUTE_ZONES.map((zone) => (
            <div key={zone} className="flex items-center gap-2">
              <span className="w-6 text-xs font-bold text-slate-500">{zone}</span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setZoneOverride(zone, null)}
                  className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                    overrides[zone] == null
                      ? "bg-slate-700 text-slate-300"
                      : "bg-slate-900 text-slate-600"
                  }`}
                >
                  défaut
                </button>
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setZoneOverride(zone, level)}
                    className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${bisonFuteBadgeClass(level)} ${
                      overrides[zone] === level ? "ring-1 ring-white/40" : ""
                    }`}
                  >
                    {BISON_FUTE_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CodeDirectionForm({
  value,
  onChange,
}: {
  value: Extract<DirectionInput, { mode: "code" }>;
  onChange: (v: DirectionInput) => void;
}) {
  return (
    <div className="space-y-2">
      <input
        value={value.encoding}
        onChange={(e) => onChange({ ...value, encoding: e.target.value })}
        placeholder="Ex. O4N, 3R4R, R, N"
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-sm text-white placeholder:text-slate-600"
      />
      <p className="text-[10px] leading-relaxed text-slate-500">
        {BISON_FUTE_ENCODING_HELP}
      </p>
    </div>
  );
}

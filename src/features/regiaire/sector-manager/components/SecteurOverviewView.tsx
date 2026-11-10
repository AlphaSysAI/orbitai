// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Clock,
  MapPin,
  PackageX,
  PiggyBank,
  Truck,
} from "lucide-react";

import { formatEur, formatHours } from "@/features/regiaire/lib/business-stats";
import { SHIFT_PERIOD_LABELS } from "@/features/regiaire/shift/schemas";
import type {
  SecteurAireCard,
  SecteurOverview,
} from "@/features/regiaire/sector-manager/actions";

export function SecteurOverviewView({ overview }: { overview: SecteurOverview }) {
  return (
    <div className="space-y-6">
      {/* Totaux secteur */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TotalCard
          icon={<PiggyBank size={16} />}
          label="Économies"
          value={formatEur(overview.totals.totalSavingsEur)}
          accent="emerald"
        />
        <TotalCard
          icon={<Clock size={16} />}
          label="Heures gagnées"
          value={`${formatHours(overview.totals.receptionHoursSaved)} h`}
          accent="sky"
        />
        <TotalCard
          icon={<PackageX size={16} />}
          label="Périmés J+3"
          value={String(overview.totals.expiringCount)}
          accent={overview.totals.expiringCount > 0 ? "rose" : "slate"}
        />
        <TotalCard
          icon={<Truck size={16} />}
          label="Livraisons"
          value={String(overview.totals.inProgressCount)}
          accent="slate"
        />
      </div>

      {/* Cartes par aire */}
      {overview.aires.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-500">
          Aucune aire rattachée à ce secteur.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {overview.aires.map((aire) => (
            <AireTable key={aire.aireId} aire={aire} />
          ))}
        </div>
      )}
    </div>
  );
}

function TotalCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "emerald" | "sky" | "rose" | "slate";
}) {
  const accentMap = {
    emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-600/5",
    sky: "text-sky-400 border-sky-500/20 bg-sky-600/5",
    rose: "text-rose-400 border-rose-500/20 bg-rose-600/5",
    slate: "text-slate-400 border-slate-800 bg-slate-900/40",
  } as const;
  return (
    <div className={`rounded-2xl border p-4 ${accentMap[accent]}`}>
      <div className="flex items-center gap-1.5 opacity-90">
        {icon}
        <p className="text-[9px] font-black uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums text-white">{value}</p>
    </div>
  );
}

function AireTable({ aire }: { aire: SecteurAireCard }) {
  const hasAlert = aire.expiringCount > 0;
  const avgCompletion =
    aire.recentClosures.length > 0
      ? Math.round(
          aire.recentClosures.reduce((s, c) => s + c.completionPct, 0) /
            aire.recentClosures.length
        )
      : null;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-slate-900/50 ${
        hasAlert ? "border-rose-500/25" : "border-slate-800"
      }`}
    >
      {/* En-tête aire */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/70 p-4">
        <div className="flex items-start gap-2">
          <MapPin
            size={16}
            className={`mt-0.5 shrink-0 ${hasAlert ? "text-rose-400" : "text-violet-400"}`}
          />
          <div>
            <p className="font-bold leading-tight text-white">{aire.name}</p>
            {aire.city && <p className="text-[11px] text-slate-500">{aire.city}</p>}
          </div>
        </div>
        <Link
          href={`/station/${aire.aireId}/verdict`}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-300 transition-colors hover:border-violet-500/50 hover:text-violet-300"
        >
          <Brain size={12} />
          Verdict
          <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Économies */}
      <div className="grid grid-cols-3 divide-x divide-slate-800/70 border-b border-slate-800/70">
        <Cell label="Économies" value={formatEur(aire.savings.totalSavingsEur)} highlight="emerald" />
        <Cell
          label="Périmés J+3"
          value={String(aire.expiringCount)}
          highlight={aire.expiringCount > 0 ? "rose" : "none"}
        />
        <Cell label="Livraisons" value={String(aire.inProgressCount)} highlight="none" />
      </div>

      {/* Tâches employés */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Tâches équipe
          </p>
          {avgCompletion !== null && (
            <span className="text-[10px] font-bold text-slate-400">
              {avgCompletion}% complétion moy. (7j)
            </span>
          )}
        </div>

        {/* En cours aujourd'hui */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["matin", "apres_midi", "nuit"] as const).map((shift) => {
            const closure = aire.todayClosures.find((c) => c.shift === shift);
            return (
              <span
                key={shift}
                className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
                  closure
                    ? closure.completionPct >= 100
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                    : "bg-slate-800/60 text-slate-600"
                }`}
              >
                {SHIFT_PERIOD_LABELS[shift]}
                {closure ? ` ${closure.completionPct}%` : " —"}
              </span>
            );
          })}
        </div>

        {/* Historique récent */}
        {aire.recentClosures.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {aire.recentClosures.slice(0, 4).map((c, i) => (
              <li
                key={`${c.serviceDate}-${c.shift}-${i}`}
                className="flex items-center justify-between text-[11px] text-slate-500"
              >
                <span>
                  {c.serviceDate} · {SHIFT_PERIOD_LABELS[c.shift as "matin"] ?? c.shift}
                </span>
                <span className="tabular-nums text-slate-400">
                  {c.checkedTasks}/{c.totalTasks} · {c.completionPct}%
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[11px] italic text-slate-600">
            Aucune clôture sur les 7 derniers jours.
          </p>
        )}
      </div>
    </article>
  );
}

function Cell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight: "emerald" | "rose" | "none";
}) {
  const color =
    highlight === "emerald"
      ? "text-emerald-400"
      : highlight === "rose"
        ? "text-rose-400"
        : "text-white";
  return (
    <div className="px-3 py-3 text-center">
      <p className={`text-lg font-black tabular-nums leading-none ${color}`}>{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">
        {label}
      </p>
    </div>
  );
}

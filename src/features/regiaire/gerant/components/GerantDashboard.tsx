// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Clock,
  Loader2,
  MapPin,
  PackageX,
  PiggyBank,
  ShoppingCart,
  Truck,
} from "lucide-react";

import { getGerantOverview } from "@/features/regiaire/gerant/actions";
import type { GerantAireCard, GerantOverview } from "@/features/regiaire/gerant/actions/overview";
import { formatEur, formatHours } from "@/features/regiaire/lib/business-stats";
import { SHIFT_PERIOD_LABELS } from "@/features/regiaire/shift/schemas";

export function GerantDashboard() {
  const [overview, setOverview] = useState<GerantOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      const res = await getGerantOverview();
      if (!res.success) {
        setError(res.error);
      } else {
        setOverview(res.data);
      }
      setIsLoading(false);
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <p className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-red-300">
        {error ?? "Impossible de charger le tableau de bord."}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
          Exploitation
        </p>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-white">
          Mes aires
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Vue détaillée — périmés, économies, réappro et équipe par site.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <TotalCard
          icon={<PiggyBank size={16} />}
          label="Économies"
          value={formatEur(overview.totals.totalSavingsEur)}
          accent="emerald"
        />
        <TotalCard
          icon={<PackageX size={16} />}
          label="Périmés J+3"
          value={String(overview.totals.expiringCount)}
          accent={overview.totals.expiringCount > 0 ? "rose" : "slate"}
        />
        <TotalCard
          icon={<Clock size={16} />}
          label="Heures gagnées"
          value={`${formatHours(overview.totals.receptionHoursSaved)} h`}
          accent="sky"
        />
        <TotalCard
          icon={<Truck size={16} />}
          label="Livraisons"
          value={String(overview.totals.inProgressCount)}
          accent="slate"
        />
        <TotalCard
          icon={<ShoppingCart size={16} />}
          label="Réappro"
          value={String(overview.totals.replenishmentSkuCount)}
          accent="amber"
        />
      </div>

      {overview.aires.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-500">
          Aucune aire ne vous est attribuée. Contactez votre chef de secteur.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {overview.aires.map((aire) => (
            <GerantAireCardView key={aire.aireId} aire={aire} />
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
  accent: "emerald" | "sky" | "rose" | "slate" | "amber";
}) {
  const accentMap = {
    emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-600/5",
    sky: "text-sky-400 border-sky-500/20 bg-sky-600/5",
    rose: "text-rose-400 border-rose-500/20 bg-rose-600/5",
    slate: "text-slate-400 border-slate-800 bg-slate-900/40",
    amber: "text-amber-400 border-amber-500/20 bg-amber-600/5",
  } as const;

  return (
    <div className={`rounded-2xl border p-4 ${accentMap[accent]}`}>
      <div className="flex items-center gap-1.5 opacity-90">
        {icon}
        <p className="text-[9px] font-black uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-xl font-black tabular-nums text-white sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function GerantAireCardView({ aire }: { aire: GerantAireCard }) {
  const hasAlert = aire.expiringCount > 0;
  const base = `/station/${aire.aireId}`;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-slate-900/50 ${
        hasAlert ? "border-rose-500/25" : "border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/70 p-4">
        <div className="flex items-start gap-2">
          <MapPin
            size={16}
            className={`mt-0.5 shrink-0 ${hasAlert ? "text-rose-400" : "text-amber-400"}`}
          />
          <div>
            <p className="font-bold leading-tight text-white">{aire.name}</p>
            {aire.city && (
              <p className="text-[11px] text-slate-500">{aire.city}</p>
            )}
          </div>
        </div>
        <Link
          href={`${base}/dashboard`}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-300 transition-colors hover:border-amber-500/50 hover:text-amber-300"
        >
          Détail
          <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-800/70 border-b border-slate-800/70">
        <MetricCell label="Économies" value={formatEur(aire.savings.totalSavingsEur)} />
        <MetricCell
          label="Périmés J+3"
          value={String(aire.expiringCount)}
          alert={aire.expiringCount > 0}
        />
        <MetricCell label="Livraisons" value={String(aire.inProgressCount)} />
      </div>

      <div className="border-b border-slate-800/70 p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Suggestions de commande
        </p>
        {aire.replenishmentHints.length === 0 ? (
          <p className="mt-2 text-xs text-slate-600">Stock couvert sur l&apos;horizon 7 j.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {aire.replenishmentHints.map((hint) => (
              <li
                key={`${hint.productName}-${hint.suggestedOrderQty}`}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate text-slate-300">{hint.productName}</span>
                <span className="shrink-0 font-bold tabular-nums text-amber-400">
                  +{hint.suggestedOrderQty} u.
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`${base}/verdict`}
          className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-400 hover:text-violet-300"
        >
          <Brain size={12} />
          Plan réappro complet
        </Link>
      </div>

      <div className="p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Quarts aujourd&apos;hui
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["matin", "apres_midi", "nuit"] as const).map((shift) => {
            const closure = aire.todayClosures.find((c) => c.shift === shift);
            return (
              <span
                key={shift}
                className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
                  closure
                    ? closure.completionPct >= 100
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-400"
                    : "bg-slate-800 text-slate-600"
                }`}
              >
                {SHIFT_PERIOD_LABELS[shift]}
                {closure ? ` ${closure.completionPct}%` : " —"}
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`${base}/equipe`}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:border-sky-500/40 hover:text-sky-300"
          >
            Équipe
          </Link>
          <Link
            href={`${base}/deliveries`}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:border-amber-500/40 hover:text-amber-300"
          >
            Réceptions
          </Link>
        </div>
      </div>
    </article>
  );
}

function MetricCell({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-black tabular-nums ${
          alert ? "text-rose-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Network,
  PackageX,
  PiggyBank,
  Users,
} from "lucide-react";

import {
  getDirectionOverview,
  type DirectionOverview,
  type RegionalGroup,
} from "@/features/regiaire/direction/actions";
import type { ChefSummary } from "@/features/regiaire/region/actions";
import { formatEur } from "@/features/regiaire/lib/business-stats";

export function DirectionFranceDashboard() {
  const [overview, setOverview] = useState<DirectionOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await getDirectionOverview();
      if (result.success) setOverview(result.data);
      else setError(result.error);
      setIsLoading(false);
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-violet-400" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      </div>
    );
  }

  const t = overview?.totals;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          Direction France
        </p>
        <h1 className="mt-1 text-2xl font-extrabold uppercase italic tracking-tighter text-white">
          Vue consolidée
        </h1>
      </header>

      {/* Totaux org */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Total icon={<PiggyBank size={16} />} label="Économies" value={formatEur(t?.totalSavingsEur ?? 0)} accent="emerald" />
        <Total icon={<Network size={16} />} label="Régionaux" value={String(t?.regionalCount ?? 0)} accent="slate" />
        <Total icon={<Users size={16} />} label="Chefs" value={String(t?.chefCount ?? 0)} accent="slate" />
        <Total icon={<PackageX size={16} />} label="Périmés J+3" value={String(t?.expiringCount ?? 0)} accent={(t?.expiringCount ?? 0) > 0 ? "rose" : "slate"} />
      </div>

      {/* Régionaux */}
      <div className="space-y-3">
        {(overview?.regionals ?? []).map((reg) => (
          <RegionalRow
            key={reg.regionalUserId}
            reg={reg}
            isOpen={expanded === reg.regionalUserId}
            onToggle={() =>
              setExpanded(expanded === reg.regionalUserId ? null : reg.regionalUserId)
            }
          />
        ))}

        {(overview?.unassignedChefs ?? []).length > 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
              Chefs sans directeur régional
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {overview!.unassignedChefs.map((chef) => (
                <ChefRow key={chef.chefUserId} chef={chef} />
              ))}
            </div>
          </div>
        )}

        {(overview?.regionals ?? []).length === 0 &&
          (overview?.unassignedChefs ?? []).length === 0 && (
            <p className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-500">
              Aucun directeur régional ni chef de secteur configuré.
            </p>
          )}
      </div>
    </div>
  );
}

function RegionalRow({
  reg,
  isOpen,
  onToggle,
}: {
  reg: RegionalGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-slate-900"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10">
            <Network size={16} className="text-sky-400" />
          </div>
          <div>
            <p className="font-bold text-white">{reg.regionalName}</p>
            <p className="text-xs text-slate-500">
              {reg.chefs.length} chef{reg.chefs.length > 1 ? "s" : ""} · {reg.aireCount} aire
              {reg.aireCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-black tabular-nums text-emerald-400">
              {formatEur(reg.totalSavingsEur)}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
              Économies
            </p>
          </div>
          {isOpen ? (
            <ChevronUp size={16} className="text-slate-500" />
          ) : (
            <ChevronDown size={16} className="text-slate-500" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-slate-800 p-4">
          {reg.chefs.length === 0 ? (
            <p className="text-xs text-slate-500">Aucun chef rattaché.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {reg.chefs.map((chef) => (
                <ChefRow key={chef.chefUserId} chef={chef} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChefRow({ chef }: { chef: ChefSummary }) {
  return (
    <Link
      href={`/region/chef/${chef.chefUserId}`}
      className="group flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 transition-colors hover:border-violet-500/50 hover:bg-slate-900"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{chef.chefName}</p>
        <p className="truncate text-[11px] text-slate-500">
          {chef.secteurName ?? "Secteur non défini"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
          <MapPin size={11} className="text-slate-600" />
          {chef.aireCount}
        </span>
        <span className="text-xs font-black tabular-nums text-emerald-400">
          {formatEur(chef.totalSavingsEur)}
        </span>
        <ArrowRight
          size={13}
          className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-400"
        />
      </div>
    </Link>
  );
}

function Total({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "emerald" | "rose" | "slate";
}) {
  const map = {
    emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-600/5",
    rose: "text-rose-400 border-rose-500/20 bg-rose-600/5",
    slate: "text-slate-400 border-slate-800 bg-slate-900/40",
  } as const;
  return (
    <div className={`rounded-2xl border p-4 ${map[accent]}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[9px] font-black uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums text-white">{value}</p>
    </div>
  );
}

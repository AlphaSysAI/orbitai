// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  MapPin,
  PackageX,
  PiggyBank,
  Users,
} from "lucide-react";

import {
  getRegionOverview,
  type RegionOverview,
} from "@/features/regiaire/region/actions";
import { formatEur } from "@/features/regiaire/lib/business-stats";

export function DirecteurRegionDashboard() {
  const [overview, setOverview] = useState<RegionOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await getRegionOverview();
      if (result.success) setOverview(result.data);
      else setError(result.error);
      setIsLoading(false);
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-sky-400" size={32} />
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

  const chefs = overview?.chefs ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          Directeur régional
        </p>
        <h1 className="mt-1 text-2xl font-extrabold uppercase italic tracking-tighter text-white">
          Ma région
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {chefs.length} chef{chefs.length > 1 ? "s" : ""} de secteur ·{" "}
          {overview?.totals.aireCount ?? 0} aire
          {(overview?.totals.aireCount ?? 0) > 1 ? "s" : ""}
        </p>
      </header>

      {/* Totaux région */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-600/5 p-4">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <PiggyBank size={16} />
            <p className="text-[9px] font-black uppercase tracking-wider">Économies</p>
          </div>
          <p className="mt-2 text-2xl font-black tabular-nums text-white">
            {formatEur(overview?.totals.totalSavingsEur ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Users size={16} />
            <p className="text-[9px] font-black uppercase tracking-wider">Chefs</p>
          </div>
          <p className="mt-2 text-2xl font-black tabular-nums text-white">
            {overview?.totals.chefCount ?? 0}
          </p>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            (overview?.totals.expiringCount ?? 0) > 0
              ? "border-rose-500/20 bg-rose-600/5"
              : "border-slate-800 bg-slate-900/40"
          }`}
        >
          <div
            className={`flex items-center gap-1.5 ${
              (overview?.totals.expiringCount ?? 0) > 0 ? "text-rose-400" : "text-slate-400"
            }`}
          >
            <PackageX size={16} />
            <p className="text-[9px] font-black uppercase tracking-wider">Périmés J+3</p>
          </div>
          <p className="mt-2 text-2xl font-black tabular-nums text-white">
            {overview?.totals.expiringCount ?? 0}
          </p>
        </div>
      </div>

      {/* Cartes chefs */}
      {chefs.length === 0 ? (
        <p className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-500">
          Aucun chef de secteur ne vous est rattaché.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {chefs.map((chef) => (
            <Link
              key={chef.chefUserId}
              href={`/region/chef/${chef.chefUserId}`}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-all hover:border-sky-500/50 hover:bg-slate-900"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-500/0 via-sky-500/60 to-sky-500/0 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-white">{chef.chefName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {chef.secteurName ?? "Secteur non défini"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-300">
                  <MapPin size={10} />
                  {chef.aireCount}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-950/60 px-3 py-2">
                  <p className="text-sm font-black tabular-nums text-emerald-400">
                    {formatEur(chef.totalSavingsEur)}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
                    Économies
                  </p>
                </div>
                <div className="rounded-lg bg-slate-950/60 px-3 py-2">
                  <p
                    className={`text-sm font-black tabular-nums ${
                      chef.expiringCount > 0 ? "text-rose-400" : "text-white"
                    }`}
                  >
                    {chef.expiringCount}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
                    Périmés J+3
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-500/60 transition-colors group-hover:text-sky-400">
                Détail du secteur
                <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

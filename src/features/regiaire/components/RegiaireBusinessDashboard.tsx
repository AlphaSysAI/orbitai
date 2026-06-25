// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Clock,
  Loader2,
  PackageX,
  TrendingUp,
} from "lucide-react";

import { getRegiaireBusinessDashboardStats } from "@/features/regiaire/actions/get-business-dashboard-stats";
import type { RegiaireBusinessDashboardStats } from "@/features/regiaire/actions/get-business-dashboard-stats";
import {
  formatEur,
  formatHours,
  REGIAIRE_RECEPTION_MINUTES,
  TRADITIONAL_RECEPTION_MINUTES,
} from "@/features/regiaire/lib/business-stats";

export function RegiaireBusinessDashboard() {
  const [stats, setStats] = useState<RegiaireBusinessDashboardStats | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError(null);
      const result = await getRegiaireBusinessDashboardStats();
      if (!result.success) {
        setError(result.error);
        setIsLoading(false);
        return;
      }
      setStats(result.data);
      setIsLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-emerald-500/30 bg-gradient-to-br from-emerald-600/10 to-slate-900/40 p-8 shadow-xl lg:col-span-2">
          <div className="mb-4 flex items-center gap-3 text-emerald-400">
            <TrendingUp size={28} />
            <p className="font-black text-[11px] uppercase tracking-widest text-white">
              Économies totales
            </p>
          </div>
          <p className="text-sm text-slate-400">
            Périmés et stock — toutes vos aires confondues.
          </p>

          {isLoading ? (
            <div className="mt-8 flex justify-center py-6">
              <Loader2 className="animate-spin text-emerald-400" size={28} />
            </div>
          ) : error ? (
            <p className="mt-6 text-sm text-red-300">{error}</p>
          ) : stats ? (
            <>
              <p className="mt-6 text-4xl font-black tabular-nums text-white">
                {formatEur(stats.totalSavingsEur)}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
                <span>
                  Périmés (alertes J+1 à J+3) :{" "}
                  <strong className="text-emerald-300">
                    {formatEur(stats.expirySavingsEur)}
                  </strong>
                </span>
                <span>
                  Stock suivi (DLC) :{" "}
                  <strong className="text-emerald-300">
                    {formatEur(stats.stockSavingsEur)}
                  </strong>
                </span>
              </div>
              <p className="mt-4 text-[10px] text-slate-600">
                Estimation basée sur le stock actuel ({stats.aireCount} aire
                {stats.aireCount !== 1 ? "s" : ""}) et des valeurs unitaires par
                catégorie produit.
              </p>
            </>
          ) : null}
        </div>

        <div className="rounded-[2rem] border border-amber-500/30 bg-gradient-to-br from-amber-600/10 to-slate-900/40 p-8 shadow-xl">
          <div className="mb-4 flex items-center gap-3 text-amber-400">
            <Clock size={28} />
            <p className="font-black text-[11px] uppercase tracking-widest text-white">
              Temps gagné — réceptions
            </p>
          </div>
          <p className="text-sm text-slate-400">
            {TRADITIONAL_RECEPTION_MINUTES} min habituellement →{" "}
            {REGIAIRE_RECEPTION_MINUTES} min avec RégiAire.
          </p>

          {isLoading ? (
            <div className="mt-8 flex justify-center py-6">
              <Loader2 className="animate-spin text-amber-400" size={24} />
            </div>
          ) : stats ? (
            <>
              <p className="mt-6 text-4xl font-black tabular-nums text-white">
                {formatHours(stats.receptionHoursSaved)} h
              </p>
              <p className="mt-3 text-xs text-slate-400">
                {stats.completedReceptions} réception
                {stats.completedReceptions !== 1 ? "s" : ""} finalisée
                {stats.completedReceptions !== 1 ? "s" : ""} ×{" "}
                {TRADITIONAL_RECEPTION_MINUTES - REGIAIRE_RECEPTION_MINUTES} min
                gagnées
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/station"
          className="group rounded-[2rem] border border-amber-500/30 bg-gradient-to-br from-amber-600/10 to-slate-900/40 p-8 shadow-xl transition-all hover:border-amber-500/50 hover:from-amber-600/15"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-amber-400">
              <Brain size={28} />
              <p className="font-black text-[11px] uppercase tracking-widest text-white">
                Verdict IA
              </p>
            </div>
            <ArrowRight
              size={18}
              className="text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-400"
            />
          </div>
          <p className="text-sm font-medium leading-relaxed text-slate-400">
            Synthèse météo, trafic, vacances et tendances pour piloter vos
            stations.
          </p>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-amber-500/80">
            Ouvrir RégiAire
          </p>
        </Link>

        <div className="rounded-[2rem] border border-slate-800/50 bg-slate-900/40 p-8 shadow-xl">
          <div className="mb-4 flex items-center gap-3 text-emerald-400">
            <PackageX size={28} />
            <p className="font-black text-[11px] uppercase tracking-widest text-white">
              Périmés & stock
            </p>
          </div>
          <p className="text-sm font-medium text-slate-400">
            Les économies périmés proviennent des lots repérés avant DLC ; le
            stock suivi réduit la casse sur l&apos;inventaire tracé.
          </p>
          {!isLoading && stats && stats.aireCount === 0 && (
            <p className="mt-4 text-xs text-amber-400/80">
              Aucune aire configurée — contactez OrbitAI pour activer vos sites.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

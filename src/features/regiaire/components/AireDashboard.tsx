// Copyright © 2026 OrbitSys. Tous droits réservés.

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  PackageX,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

import { getAire } from "@/features/regiaire/aires/actions";
import { getRegiaireCapabilities } from "@/features/regiaire/actions/get-regiaire-capabilities";
import { computeAireSavings } from "@/features/regiaire/lib/aire-savings";
import { formatEur } from "@/features/regiaire/lib/business-stats";
import { todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import { generateReplenishmentPlan } from "@/features/regiaire/verdict/actions/generate-replenishment-plan";
import { getExpiringStock } from "@/features/regiaire/verdict/actions/get-expiring-stock";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";

type AireDashboardProps = {
  aireId: string;
};

export async function AireDashboard({ aireId }: AireDashboardProps) {
  const capsRes = await getRegiaireCapabilities(aireId);
  if (!capsRes.success) {
    return (
      <p className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-red-300">
        {capsRes.error}
      </p>
    );
  }

  const caps = capsRes.data;
  const [aireResult, expiringResult] = await Promise.all([
    getAire(aireId),
    getExpiringStock(aireId),
  ]);

  const aireName = aireResult.success ? aireResult.data.name : "Aire";
  const expiringCount = expiringResult.success
    ? expiringResult.data.perimes.length + expiringResult.data.proches.length
    : null;

  const base = `/station/${aireId}`;
  const hasAlert = expiringCount !== null && expiringCount > 0;

  let savingsTotal: number | null = null;
  let replenishmentLines: { name: string; qty: number }[] = [];

  if (caps.canViewVerdict) {
    try {
      const supabase = await createServerSupabaseClient();
      const db = forWrite(supabase);
      const savings = await computeAireSavings(db, aireId, todayParisIso());
      savingsTotal = savings.totalSavingsEur;

      const planRes = await generateReplenishmentPlan(aireId);
      if (planRes.success) {
        replenishmentLines = planRes.data.lines
          .filter((l) => l.suggestedOrderQty > 0)
          .slice(0, 5)
          .map((l) => ({
            name: l.product.name,
            qty: l.suggestedOrderQty,
          }));
      }
    } catch {
      savingsTotal = null;
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-7">
      <div className="flex items-center justify-between pb-1">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-700">
            Aire de service
          </p>
          <h1 className="mt-0.5 text-xl font-black uppercase tracking-tight text-white">
            {aireName}
          </h1>
        </div>
        <Link
          href="/station"
          className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-600 transition-colors hover:border-slate-700 hover:text-slate-300"
        >
          ← Changer
        </Link>
      </div>

      {caps.canViewVerdict && savingsTotal !== null && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600">
              Économies estimées
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-emerald-400">
              {formatEur(savingsTotal)}
            </p>
          </div>
          <div
            className={`rounded-xl border p-4 ${
              hasAlert
                ? "border-rose-500/25 bg-rose-500/5"
                : "border-slate-800 bg-slate-900/60"
            }`}
          >
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
              Lots périmés / J+3
            </p>
            <p
              className={`mt-1 text-2xl font-black tabular-nums ${
                hasAlert ? "text-rose-400" : "text-white"
              }`}
            >
              {expiringCount ?? "—"}
            </p>
          </div>
        </div>
      )}

      {caps.canViewVerdict && (
        <Link
          href={`${base}/verdict`}
          className="group relative block overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/12 via-slate-900/80 to-slate-950 p-5 transition-all duration-200 hover:border-violet-500/50"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-violet-500/30">
                <Brain className="text-violet-400" size={20} />
              </div>
              <div>
                <p className="font-black text-white">Verdict IA</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Analyse · recommandations · réassort
                </p>
              </div>
            </div>
            <ArrowRight size={13} className="text-violet-500/60 group-hover:text-violet-400" />
          </div>
        </Link>
      )}

      {caps.canViewVerdict && replenishmentLines.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={14} className="text-amber-400" />
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-500/80">
              Suggestions de commande
            </p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {replenishmentLines.map((line) => (
              <li
                key={line.name}
                className="flex justify-between gap-2 text-xs text-slate-300"
              >
                <span className="truncate">{line.name}</span>
                <span className="shrink-0 font-bold text-amber-400">
                  +{line.qty} u.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {expiringCount !== null && !caps.canViewVerdict && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
            hasAlert
              ? "border-rose-500/30 bg-rose-500/6"
              : "border-emerald-500/20 bg-emerald-500/5"
          }`}
        >
          {hasAlert ? (
            <AlertTriangle size={14} className="shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
          )}
          <p
            className={`flex-1 text-xs font-bold ${
              hasAlert ? "text-rose-300" : "text-emerald-400"
            }`}
          >
            {hasAlert ? "Lots proches de péremption" : "Aucun lot en alerte DLC"}
          </p>
          {hasAlert && (
            <span className="text-xl font-black tabular-nums text-rose-400">
              {expiringCount}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {caps.canAccessReception && (
          <Link
            href={`${base}/deliveries`}
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition-all hover:border-amber-500/40"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Truck className="text-amber-400" size={19} />
            </div>
            <p className="font-bold text-white">Réceptions</p>
            <p className="mt-0.5 text-[11px] text-slate-600">
              Scan BL · réconciliation stock
            </p>
          </Link>
        )}

        {caps.canAccessEquipe && (
          <Link
            href={`${base}/equipe`}
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition-all hover:border-sky-500/40"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
              <Users className="text-sky-400" size={19} />
            </div>
            <p className="font-bold text-white">Équipe</p>
            <p className="mt-0.5 text-[11px] text-slate-600">
              Passation · clôture des tâches
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}

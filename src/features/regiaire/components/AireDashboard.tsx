import Link from "next/link";
import { ArrowRight, Brain, PackageX, Truck, Users } from "lucide-react";

import { getAire } from "@/features/regiaire/aires/actions";
import { getExpiringStock } from "@/features/regiaire/verdict/actions/get-expiring-stock";

type AireDashboardProps = {
  aireId: string;
};

export async function AireDashboard({ aireId }: AireDashboardProps) {
  const [aireResult, expiringResult] = await Promise.all([
    getAire(aireId),
    getExpiringStock(aireId),
  ]);

  const aireName = aireResult.success ? aireResult.data.name : "Aire";
  const expiringCount = expiringResult.success
    ? expiringResult.data.perimes.length + expiringResult.data.proches.length
    : null;

  const base = `/station/${aireId}`;

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
          {aireName}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Accès rapide aux modules opérationnels RégiAire.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`${base}/deliveries`}
          className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-amber-500/30"
        >
          <div className="mb-3 flex items-center justify-between">
            <Truck className="text-amber-400" size={24} />
            <ArrowRight
              size={16}
              className="text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-400"
            />
          </div>
          <p className="font-bold text-white">Réceptions</p>
          <p className="mt-1 text-xs text-slate-500">
            Livraisons, scan BL et réconciliation stock.
          </p>
        </Link>

        <Link
          href={`${base}/equipe`}
          className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-amber-500/30"
        >
          <div className="mb-3 flex items-center justify-between">
            <Users className="text-amber-400" size={24} />
            <ArrowRight
              size={16}
              className="text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-400"
            />
          </div>
          <p className="font-bold text-white">Équipe</p>
          <p className="mt-1 text-xs text-slate-500">
            Passation de quart et check-list opérationnelle.
          </p>
        </Link>

        <Link
          href={`${base}/verdict`}
          className="group rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-600/10 to-slate-900/40 p-5 transition-colors hover:border-amber-500/40"
        >
          <div className="mb-3 flex items-center justify-between">
            <Brain className="text-amber-400" size={24} />
            <ArrowRight
              size={16}
              className="text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-400"
            />
          </div>
          <p className="font-bold text-white">Verdict IA</p>
          <p className="mt-1 text-xs text-slate-500">
            Recommandations merchandising — bientôt disponible.
          </p>
        </Link>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <PackageX className="text-emerald-400" size={24} />
            <p className="font-bold text-white">Périmés proches</p>
          </div>
          {expiringCount === null ? (
            <p className="text-xs text-slate-500">Chargement impossible.</p>
          ) : expiringCount === 0 ? (
            <p className="text-sm text-slate-400">Aucun lot en alerte J+3.</p>
          ) : (
            <p className="text-3xl font-black tabular-nums text-amber-400">
              {expiringCount}
              <span className="ml-2 text-xs font-bold uppercase text-slate-500">
                lots
              </span>
            </p>
          )}
        </div>
      </div>

      <Link
        href="/station"
        className="inline-block text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300"
      >
        Changer d&apos;aire
      </Link>
    </div>
  );
}

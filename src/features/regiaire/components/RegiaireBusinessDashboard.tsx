"use client";

import Link from "next/link";
import { ArrowRight, Brain, PackageX } from "lucide-react";

export function RegiaireBusinessDashboard() {
  return (
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
          Synthèse météo, trafic, vacances et tendances pour piloter la station.
        </p>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-amber-500/80">
          Ouvrir le Verdict
        </p>
      </Link>

      <div className="rounded-[2rem] border border-slate-800/50 bg-slate-900/40 p-8 shadow-xl">
        <div className="mb-4 flex items-center gap-3 text-emerald-400">
          <PackageX size={28} />
          <p className="font-black text-[11px] uppercase tracking-widest text-white">
            Économies périmés
          </p>
        </div>
        <p className="text-sm font-medium text-slate-400">
          Montant des économies réalisées grâce à la gestion des produits périmés.
        </p>
        <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-center">
          <p className="text-3xl font-black tabular-nums text-slate-600">—</p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Fonctionnalité à venir
          </p>
        </div>
      </div>
    </div>
  );
}

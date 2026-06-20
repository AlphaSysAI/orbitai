"use client";

import { Activity, Zap } from "lucide-react";

import { SaasBrandTitle } from "@/components/branding/SaasBrandTitle";
import { RegiaireBusinessDashboard } from "@/features/regiaire/components/RegiaireBusinessDashboard";
import {
  getPrimaryBusinessModule,
  resolveSaasBrandFromModules,
} from "@/lib/organizations/saas-branding";
import { ORG_MODULE_NAMES, type EnabledOrgModule } from "@/lib/organizations/types";

type GlobalDashboardProps = {
  enabledModules?: EnabledOrgModule[];
};

export function GlobalDashboard({
  enabledModules = [],
}: GlobalDashboardProps) {
  const brand = resolveSaasBrandFromModules(enabledModules);
  const primaryModule = getPrimaryBusinessModule(enabledModules);

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in py-10 duration-700 text-white">
      <div className="mb-12">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          {brand.dashboardTitle}
        </p>
        <h1 className="mt-2">
          <SaasBrandTitle brand={brand} size="lg" />
        </h1>
      </div>

      <div className="mb-12">
        {primaryModule === ORG_MODULE_NAMES.REGIAIRE_CORE && (
          <RegiaireBusinessDashboard />
        )}
        {primaryModule === ORG_MODULE_NAMES.ARTISAN_CORE && (
          <BusinessModulePlaceholder label="Artisan" />
        )}
        {primaryModule === ORG_MODULE_NAMES.HOTEL_CORE && (
          <BusinessModulePlaceholder label="Hôtel" />
        )}
        {!primaryModule && (
          <div className="rounded-[2rem] border border-dashed border-slate-700 bg-slate-900/30 p-10 text-center">
            <p className="text-sm text-slate-400">
              Aucun module métier vertical activé pour votre organisation.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-[2rem] border border-slate-800/50 bg-slate-900/40 p-8 shadow-xl transition-all hover:border-slate-700">
          <div className="mb-4 flex items-center gap-4 text-yellow-400">
            <Zap size={24} />
            <p className="font-black text-[11px] uppercase tracking-widest text-white">
              Moteur IA
            </p>
          </div>
          <p className="text-sm font-medium text-slate-400">GPT-4o Vision</p>
        </div>
        <div className="rounded-[2rem] border border-slate-800/50 bg-slate-900/40 p-8 shadow-xl transition-all hover:border-slate-700">
          <div className="mb-4 flex items-center gap-4 text-green-400">
            <Activity size={24} />
            <p className="font-black text-[11px] uppercase tracking-widest text-white">
              Statut
            </p>
          </div>
          <p className="text-sm font-medium text-slate-400">Système opérationnel</p>
        </div>
      </div>
    </div>
  );
}

function BusinessModulePlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-[2rem] border border-slate-800/50 bg-slate-900/40 p-8 text-center">
      <p className="text-sm text-slate-400">
        Dashboard {label} — contenu métier à venir.
      </p>
    </div>
  );
}

// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

import {
  getSecteurOverview,
  type SecteurOverview,
} from "@/features/regiaire/sector-manager/actions";
import { SecteurOverviewView } from "@/features/regiaire/sector-manager/components/SecteurOverviewView";
import { SecteurVerdictPanel } from "@/features/regiaire/sector-manager/components/SecteurVerdictPanel";

export function ChefSecteurDashboard() {
  const [overview, setOverview] = useState<SecteurOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await getSecteurOverview();
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

  if (!overview) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
        <MapPin size={36} className="mx-auto text-slate-600" />
        <p className="font-semibold text-white">Aucun secteur attribué</p>
        <p className="text-sm text-slate-400">
          Contactez votre administrateur pour qu&apos;un secteur vous soit attribué.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          Chef de secteur
        </p>
        <h1 className="mt-1 text-2xl font-extrabold uppercase italic tracking-tighter text-white">
          {overview.secteurName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {overview.aires.length} aire{overview.aires.length > 1 ? "s" : ""} sous
          supervision
        </p>
      </header>

      <SecteurVerdictPanel secteurId={overview.secteurId} />

      <SecteurOverviewView overview={overview} />
    </div>
  );
}

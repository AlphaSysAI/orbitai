// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import {
  getChefSecteurDetail,
  type GetChefDetailResult,
} from "@/features/regiaire/region/actions";
import { SecteurOverviewView } from "@/features/regiaire/sector-manager/components/SecteurOverviewView";
import { SecteurVerdictPanel } from "@/features/regiaire/sector-manager/components/SecteurVerdictPanel";

export function ChefDetailView({
  chefUserId,
  backHref = "/station",
}: {
  chefUserId: string;
  backHref?: string;
}) {
  const [state, setState] = useState<GetChefDetailResult | null>(null);

  useEffect(() => {
    void (async () => {
      setState(await getChefSecteurDetail(chefUserId));
    })();
  }, [chefUserId]);

  if (!state) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-violet-400" size={32} />
      </div>
    );
  }

  if (!state.success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-300"
        >
          <ArrowLeft size={13} />
          Retour
        </Link>
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {state.error}
        </p>
      </div>
    );
  }

  const { chefName, overview } = state.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-300"
      >
        <ArrowLeft size={13} />
        Retour
      </Link>

      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          {chefName} · {overview.secteurName}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold uppercase italic tracking-tighter text-white">
          Détail du secteur
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {overview.aires.length} aire{overview.aires.length > 1 ? "s" : ""}
        </p>
      </header>

      <SecteurVerdictPanel secteurId={overview.secteurId} />

      <SecteurOverviewView overview={overview} />
    </div>
  );
}

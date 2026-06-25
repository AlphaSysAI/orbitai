// Copyright © 2026 OrbitSys. Tous droits réservés.

import { DeliveriesList } from "@/features/regiaire/reception/components/DeliveriesList";

export default function DeliveriesPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:max-w-2xl sm:px-6">
      <header className="mb-6 flex items-end justify-between border-b border-slate-800/60 pb-5">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-700">
            Module opérationnel
          </p>
          <h1 className="mt-0.5 text-xl font-black uppercase tracking-tight text-white">
            Réceptions
          </h1>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
          <svg className="h-4 w-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3m-7 13h10a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H12a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2z"/>
          </svg>
        </div>
      </header>
      <DeliveriesList />
    </div>
  );
}

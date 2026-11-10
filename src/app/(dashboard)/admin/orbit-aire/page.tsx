// Copyright © 2026 OrbitSys. Tous droits réservés.

import Link from "next/link";
import { Zap } from "lucide-react";

import { AdminSaasHeader } from "@/features/admin/components/AdminSaasHeader";
import { SaasClientCreation } from "@/features/admin/components/SaasClientCreation";

export default function AdminOrbitAirePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <AdminSaasHeader
          title="Orbit Aire"
          subtitle="Créez une entité (enseigne). Ouvrez ensuite son administration pour gérer la hiérarchie et les aires."
        />
        <Link
          href="/admin/bison-fute"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-amber-500/40 hover:text-amber-300"
        >
          <Zap size={14} className="text-amber-400" />
          Calendrier Bison Futé
        </Link>
        <SaasClientCreation
          vertical="regiaire_core"
          verticalLabel="Orbit Aire"
          sectorPlaceholder="Ex. Station-service"
          showTransverse={false}
          manageBasePath="/admin/orbit-aire"
          entityNoun="entité"
        />
      </div>
    </div>
  );
}

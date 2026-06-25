// Copyright © 2026 OrbitSys. Tous droits réservés.

import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";

import { listAiresForOrg } from "@/features/regiaire/aires/actions";
import { getCurrentUserOrgRole } from "@/features/regiaire/sector-manager/actions";
import { ChefSecteurDashboard } from "@/features/regiaire/sector-manager/components/ChefSecteurDashboard";
import { DirecteurRegionDashboard } from "@/features/regiaire/region/components/DirecteurRegionDashboard";
import { DirectionFranceDashboard } from "@/features/regiaire/direction/components/DirectionFranceDashboard";
import { GerantDashboard } from "@/features/regiaire/gerant/components/GerantDashboard";

export default async function StationPage() {
  const role = await getCurrentUserOrgRole();

  if (role === "chef_secteur") {
    return <ChefSecteurDashboard />;
  }
  if (role === "directeur_region") {
    return <DirecteurRegionDashboard />;
  }
  if (role === "direction_france") {
    return <DirectionFranceDashboard />;
  }
  if (role === "gerant") {
    return <GerantDashboard />;
  }

  const result = await listAiresForOrg();

  if (!result.success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-red-300">{result.error}</p>
      </div>
    );
  }

  let aires = result.data;

  if (aires.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-12 text-center">
        <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
          RégiAire
        </h1>
        <p className="text-sm text-slate-400">
          Aucune aire n&apos;est encore configurée pour votre organisation.
        </p>
        <p className="text-xs text-slate-500">
          Contactez votre administrateur OrbitAI pour activer vos aires de
          service.
        </p>
      </div>
    );
  }

  if (aires.length === 1) {
    const only = aires[0]!;
    if (role === "employe") {
      redirect(`/station/${only.id}/deliveries`);
    }
    redirect(`/station/${only.id}/dashboard`);
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-8">
        {/* Hero */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/30">
            <MapPin className="text-amber-400" size={24} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            Mes aires
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sélectionnez une aire de service pour accéder aux opérations.
          </p>
        </div>

        {/* Aire cards */}
        <ul className="grid gap-3 sm:grid-cols-2">
          {aires.map((aire) => (
            <li key={aire.id}>
              <Link
                href={`/station/${aire.id}/dashboard`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition-all duration-200 hover:border-amber-500/50 hover:bg-slate-900 hover:shadow-lg hover:shadow-amber-500/5"
              >
                {/* Accent strip */}
                <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-gradient-to-r from-amber-500/0 via-amber-500/60 to-amber-500/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                    <MapPin className="text-amber-400" size={18} />
                  </div>
                  <span className="mt-0.5 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    Zone {aire.schoolZone}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="font-bold text-white">{aire.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {aire.city ?? "Ville non renseignée"}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-500/60 transition-colors group-hover:text-amber-400">
                  Accéder
                  <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

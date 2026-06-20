import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";

import { listAiresForOrg } from "@/features/regiaire/aires/actions";

export default async function StationPage() {
  const result = await listAiresForOrg();

  if (!result.success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-red-300">{result.error}</p>
      </div>
    );
  }

  const aires = result.data;

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
    redirect(`/station/${aires[0]!.id}/dashboard`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
          Mes aires
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Choisissez une aire pour accéder aux opérations RégiAire.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {aires.map((aire) => (
          <li key={aire.id}>
            <Link
              href={`/station/${aire.id}/dashboard`}
              className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-amber-500/30 hover:bg-slate-900"
            >
              <MapPin className="mt-0.5 shrink-0 text-amber-500" size={18} />
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{aire.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {aire.address ?? aire.city ?? "Ville non renseignée"} · zone{" "}
                  {aire.schoolZone}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

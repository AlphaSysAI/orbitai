import Link from "next/link";
import { Fuel } from "lucide-react";

type ModuleDisabledProps = {
  moduleLabel?: string;
};

export function ModuleDisabled({ moduleLabel = "RégiAire" }: ModuleDisabledProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#020617] px-6 text-center text-slate-200">
      <div className="mb-6 rounded-2xl bg-amber-600/10 p-4">
        <Fuel size={40} className="text-amber-400" />
      </div>
      <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
        Module non activé
      </h1>
      <p className="mt-3 max-w-md text-sm text-slate-400">
        Le module <span className="text-amber-400">{moduleLabel}</span> n&apos;est pas activé pour
        votre organisation. Contactez votre administrateur pour souscrire à cette fonctionnalité.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-slate-800 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-700"
      >
        Retour au dashboard
      </Link>
    </div>
  );
}

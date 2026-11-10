// Copyright © 2026 OrbitSys. Tous droits réservés.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function AdminSaasHeader({
  title,
  subtitle,
  backHref = "/admin",
  backLabel = "Administration",
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-200"
      >
        <ArrowLeft size={14} />
        {backLabel}
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
        {title}
      </h1>
      {subtitle && <p className="mt-2 text-sm text-slate-400">{subtitle}</p>}
    </div>
  );
}

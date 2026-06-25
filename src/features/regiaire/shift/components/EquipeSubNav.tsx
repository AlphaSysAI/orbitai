// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function buildLinks(aireId: string) {
  const base = `/station/${aireId}/equipe`;
  return [
    { href: base, label: "Passation", adminOnly: false },
    { href: `${base}/historique`, labelAdmin: "Historique", labelMember: "Passation préc.", adminOnly: false },
    { href: `${base}/employes`, label: "Employés", adminOnly: true },
    { href: `${base}/config`, label: "Config", adminOnly: true },
  ] as const;
}

export function EquipeSubNav({
  aireId,
  isAdmin,
}: {
  aireId: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const links = buildLinks(aireId);

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 p-1">
      {links.filter((l) => !l.adminOnly || isAdmin).map((link) => {
        const label =
          "labelAdmin" in link
            ? isAdmin
              ? link.labelAdmin
              : link.labelMember
            : link.label;
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-lg px-4 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all ${
              active
                ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
                : "text-slate-600 hover:text-slate-300"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

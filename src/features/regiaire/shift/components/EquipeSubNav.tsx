"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function buildLinks(aireId: string) {
  const base = `/station/${aireId}/equipe`;
  return [
    { href: base, label: "Passation", adminOnly: false },
    {
      href: `${base}/historique`,
      labelAdmin: "Historique",
      labelMember: "Passation préc.",
      adminOnly: false,
    },
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
    <nav className="flex gap-2 overflow-x-auto pb-1">
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
            className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${
              active
                ? "bg-amber-600/20 text-amber-400 border border-amber-500/40"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

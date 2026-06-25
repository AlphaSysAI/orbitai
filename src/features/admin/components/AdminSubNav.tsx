// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Clients", exact: true },
  { href: "/admin/bison-fute", label: "Calendrier Bison Futé", exact: false },
] as const;

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto mt-4 flex max-w-6xl gap-2">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
              active
                ? "border-violet-500/50 bg-violet-600/15 text-violet-300"
                : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-violet-500/40 hover:text-violet-300"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { STATION_NAV_LINKS } from "@/lib/organizations/navigation";

export function StationSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2 border-b border-slate-800 bg-[#0f172a]/80 px-6 py-3">
      <Link
        href="/"
        className="mr-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-200"
      >
        <ArrowLeft size={14} />
        OrbitAI
      </Link>
      {STATION_NAV_LINKS.map((link) => {
        const active = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              active
                ? "bg-amber-600/20 text-amber-400 border border-amber-500/40"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Icon size={14} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

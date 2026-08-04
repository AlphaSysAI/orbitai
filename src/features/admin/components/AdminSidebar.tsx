// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Fuel,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Network,
  Orbit,
  Wrench,
  X,
} from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true, color: "text-violet-400" },
  { href: "/admin/orbit-aire", label: "Orbit Aire", Icon: Fuel, exact: false, color: "text-amber-400" },
  { href: "/admin/orbit-hotel", label: "Orbit Hôtel", Icon: Network, exact: false, color: "text-sky-400" },
  { href: "/admin/orbit-artisan", label: "Orbit Artisan", Icon: Wrench, exact: false, color: "text-orange-400" },
  { href: "/admin/test-passwords", label: "Mots de passe (test)", Icon: KeyRound, exact: false, color: "text-emerald-400" },
];

export function AdminSidebar({
  isOpen = false,
  onClose,
  onLogout,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] transform flex-col border-r border-slate-800 bg-[#0f172a] text-white shadow-2xl transition-transform duration-300 ease-out lg:static lg:z-30 lg:max-w-none lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } overflow-hidden`}
    >
      <div className="flex items-center gap-3 border-b border-slate-800 p-5">
        <div className="rounded-lg bg-violet-600 p-2">
          <Orbit size={20} className="text-white" />
        </div>
        <div className="flex-1 leading-none">
          <p className="text-sm font-black uppercase italic tracking-tighter text-white">
            OrbitAll
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-violet-400">
            Administration
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-2 p-3">
        {LINKS.map(({ href, label, Icon, exact, color }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex w-full items-center gap-3 rounded-xl p-3 transition-all ${
                active
                  ? "border border-violet-500/40 bg-violet-600/15 text-white"
                  : "border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Icon size={18} className={active ? color : undefined} />
              <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl p-3 text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={18} />
          <span className="text-[10px] font-black uppercase tracking-wider">Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}

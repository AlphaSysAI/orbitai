// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Fuel, Loader2, Network, Wrench } from "lucide-react";

type ClientRow = { id: string; enabledModules: string[] };

const SAAS = [
  { key: "regiaire_core", href: "/admin/orbit-aire", label: "Orbit Aire", Icon: Fuel, color: "text-amber-400", ring: "hover:border-amber-500/50" },
  { key: "hotel_core", href: "/admin/orbit-hotel", label: "Orbit Hôtel", Icon: Network, color: "text-sky-400", ring: "hover:border-sky-500/50" },
  { key: "artisan_core", href: "/admin/orbit-artisan", label: "Orbit Artisan", Icon: Wrench, color: "text-orange-400", ring: "hover:border-orange-500/50" },
];

export function AdminDashboard() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/clients");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
        if (!cancelled) setClients(data.clients ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur chargement");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const countFor = (key: string) =>
    clients.filter((c) => c.enabledModules.includes(key)).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold uppercase italic tracking-tighter text-white sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Vue d&apos;ensemble des clients OrbitAll par SaaS.
        </p>
      </div>

      {error && (
        <p className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          Chargement…
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="rounded-xl bg-violet-600/15 p-3">
              <Building2 size={22} className="text-violet-400" />
            </div>
            <div>
              <p className="text-3xl font-black text-white">{clients.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Clients au total
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAAS.map(({ key, href, label, Icon, color, ring }) => (
              <Link
                key={key}
                href={href}
                className={`group flex flex-col justify-between gap-6 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 transition-colors ${ring}`}
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-2xl bg-slate-950/60 p-3">
                    <Icon size={24} className={color} />
                  </div>
                  <span className="text-4xl font-black text-white">{countFor(key)}</span>
                </div>
                <div>
                  <h2 className="text-base font-black uppercase tracking-tight text-white">{label}</h2>
                  <span className={`mt-2 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${color}`}>
                    Gérer
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

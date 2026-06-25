// Copyright © 2026 OrbitSys. Tous droits réservés.

import { AlertTriangle, PackageX, Sparkles } from "lucide-react";

import type { ExpiringStockItem } from "@/features/regiaire/verdict/schemas";

type VerdictExpiringSectionProps = {
  perimes: ExpiringStockItem[];
  proches: ExpiringStockItem[];
};

export function VerdictExpiringSection({
  perimes,
  proches,
}: VerdictExpiringSectionProps) {
  const hasAny = perimes.length > 0 || proches.length > 0;

  return (
    <section className="space-y-4">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Périmés & proches DLC
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Stock réel de l&apos;aire — trié par urgence.
        </p>
      </header>

      {!hasAny ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-8 text-center">
          <PackageX className="mx-auto text-slate-600" size={28} />
          <p className="mt-2 text-sm text-slate-500">
            Aucun lot en péremption imminente.
          </p>
        </div>
      ) : (
        <>
          {perimes.length > 0 && (
            <ExpiringGroup
              title="Aujourd'hui — priorité"
              tone="danger"
              items={perimes}
              actionHint="Écouler ou retirer immédiatement"
            />
          )}
          {proches.length > 0 && (
            <ExpiringGroup
              title="J+1 à J+3"
              tone="warning"
              items={proches}
              actionHint="Mettre en avant en rayon"
            />
          )}
        </>
      )}
    </section>
  );
}

function ExpiringGroup({
  title,
  tone,
  items,
  actionHint,
}: {
  title: string;
  tone: "danger" | "warning";
  items: ExpiringStockItem[];
  actionHint: string;
}) {
  const border =
    tone === "danger"
      ? "border-red-500/30 bg-red-600/5"
      : "border-amber-500/30 bg-amber-600/5";
  const badge =
    tone === "danger"
      ? "bg-red-600/20 text-red-300"
      : "bg-amber-600/20 text-amber-300";

  return (
    <div className={`rounded-2xl border p-4 ${border}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white">
          {title}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge}`}>
          {items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={`${item.productId}-${item.dlc}`}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {item.productName}
              </p>
              {item.category && (
                <p className="text-[10px] text-slate-500">{item.category}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums text-white">
                ×{item.quantity}
              </p>
              <p className="text-[10px] text-slate-500">
                DLC {item.dlc}
                {item.joursRestants <= 0
                  ? " · périmé"
                  : ` · J+${item.joursRestants}`}
              </p>
            </div>
            <p className="flex w-full items-center gap-1.5 text-[10px] text-slate-500">
              {tone === "danger" ? (
                <AlertTriangle size={11} className="text-red-400" />
              ) : (
                <Sparkles size={11} className="text-amber-400" />
              )}
              {actionHint}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import type { DeliveryLineRow } from "@/features/regiaire/reception/schemas";
import { countRemainingPackages } from "@/features/regiaire/reception/utils/delivery-ui";
import { Package } from "lucide-react";

export type ScanLineView = DeliveryLineRow & { has_dlc?: boolean };

function lineState(line: ScanLineView) {
  if (line.expected_qty === 0 && line.scanned_qty > 0) {
    return { label: "Non prévu", className: "text-orange-400" };
  }
  if (line.scanned_qty >= line.expected_qty && line.expected_qty > 0) {
    return { label: "Complet", className: "text-emerald-400" };
  }
  if (line.scanned_qty > 0) {
    return { label: "En cours", className: "text-amber-400" };
  }
  return { label: "À scanner", className: "text-slate-500" };
}

export function ScanHeader({ lines }: { lines: ScanLineView[] }) {
  const remaining = countRemainingPackages(lines);
  return (
    <div className="sticky top-0 z-10 border-b border-slate-800 bg-[#020617]/95 px-4 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Colis restants
          </p>
          <p className="text-4xl font-black tabular-nums text-amber-400">{remaining}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
          <Package size={18} className="text-slate-400" />
          <span className="text-sm text-slate-300">{lines.length} lignes</span>
        </div>
      </div>
    </div>
  );
}

export function ScanLineList({ lines }: { lines: ScanLineView[] }) {
  return (
    <ul className="mx-auto max-w-lg space-y-2 px-4 pb-32">
      {lines.map((line) => {
        const state = lineState(line);
        const rest = Math.max(0, line.expected_qty - line.scanned_qty);
        return (
          <li
            key={line.id}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{line.raw_name}</p>
                <p className="font-mono text-xs text-slate-500">
                  {line.ean ?? "EAN au scan"}
                </p>
              </div>
              <span className={`shrink-0 text-[10px] font-bold uppercase ${state.className}`}>
                {state.label}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
              <span>
                Scanné / attendu :{" "}
                <strong className="text-white">
                  {line.scanned_qty} / {line.expected_qty}
                </strong>
              </span>
              {line.expected_qty > 0 && (
                <span>
                  Reste : <strong className="text-amber-400">{rest}</strong>
                </span>
              )}
              {line.has_dlc && (
                <span>
                  DLC :{" "}
                  <strong className={line.dlc ? "text-emerald-400" : "text-red-400"}>
                    {line.dlc ?? "À saisir"}
                  </strong>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

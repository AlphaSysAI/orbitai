"use client";

import { useState } from "react";
import { Minus, Package, Plus, RotateCcw } from "lucide-react";

import type { DeliveryLineRow } from "@/features/regiaire/reception/schemas";
import { countRemainingPackages } from "@/features/regiaire/reception/utils/delivery-ui";

export type ScanLineView = DeliveryLineRow & { has_dlc?: boolean };

export type SessionScanType = "match" | "bind" | "extra";

function isSurplus(line: ScanLineView): boolean {
  return line.expected_qty > 0 && line.scanned_qty > line.expected_qty;
}

function lineState(line: ScanLineView) {
  if (isSurplus(line)) {
    return { label: "Surplus", className: "text-amber-400" };
  }
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

export function ScanHeader({
  lines,
  canUndo,
  onUndo,
  isUndoing,
}: {
  lines: ScanLineView[];
  canUndo?: boolean;
  onUndo?: () => void;
  isUndoing?: boolean;
}) {
  const remaining = countRemainingPackages(lines);

  return (
    <div className="sticky top-0 z-10 border-b border-slate-800 bg-[#020617]/95 px-4 py-4 backdrop-blur-md">
      <div className="mx-auto max-w-lg space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Colis restants
            </p>
            <p className="text-4xl font-black tabular-nums text-amber-400">
              {remaining}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
            <Package size={18} className="text-slate-400" />
            <span className="text-sm text-slate-300">{lines.length} lignes</span>
          </div>
        </div>

        {canUndo && onUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={isUndoing}
            className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:border-amber-500/40 hover:text-amber-400 disabled:opacity-50"
          >
            Annuler le dernier scan
          </button>
        )}
      </div>
    </div>
  );
}

function LineQtyControls({
  line,
  disabled,
  isAdjusting,
  onAdjust,
  onReset,
}: {
  line: ScanLineView;
  disabled?: boolean;
  isAdjusting?: boolean;
  onAdjust: (lineId: string, qty: number) => void;
  onReset: (lineId: string) => void;
}) {
  const [draftQty, setDraftQty] = useState(String(line.scanned_qty));

  const syncDraft = (qty: number) => {
    setDraftQty(String(qty));
  };

  const applyQty = (qty: number) => {
    const clamped = Math.max(0, qty);
    syncDraft(clamped);
    onAdjust(line.id, clamped);
  };

  return (
    <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || isAdjusting || line.scanned_qty <= 0}
          onClick={() => applyQty(line.scanned_qty - 1)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 disabled:opacity-40"
          aria-label="Diminuer"
        >
          <Minus size={16} />
        </button>
        <input
          type="number"
          min={0}
          value={draftQty}
          disabled={disabled || isAdjusting}
          onChange={(e) => setDraftQty(e.target.value)}
          onBlur={() => {
            const parsed = parseInt(draftQty, 10);
            if (Number.isNaN(parsed)) {
              syncDraft(line.scanned_qty);
              return;
            }
            if (parsed !== line.scanned_qty) {
              applyQty(parsed);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="h-9 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 text-center text-sm tabular-nums text-white"
        />
        <button
          type="button"
          disabled={disabled || isAdjusting}
          onClick={() => applyQty(line.scanned_qty + 1)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 disabled:opacity-40"
          aria-label="Augmenter"
        >
          <Plus size={16} />
        </button>
      </div>
      <button
        type="button"
        disabled={disabled || isAdjusting || line.scanned_qty === 0}
        onClick={() => onReset(line.id)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-amber-400 disabled:opacity-40"
      >
        <RotateCcw size={12} />
        Réinitialiser cette référence
      </button>
    </div>
  );
}

export function ScanLineList({
  lines,
  disabled,
  adjustingLineId,
  onAdjustQty,
  onResetLine,
}: {
  lines: ScanLineView[];
  disabled?: boolean;
  adjustingLineId?: string | null;
  onAdjustQty: (lineId: string, qty: number) => void;
  onResetLine: (lineId: string) => void;
}) {
  return (
    <ul className="mx-auto max-w-lg space-y-2 px-4 pb-32">
      {lines.map((line) => {
        const state = lineState(line);
        const surplus = isSurplus(line);
        const rest = Math.max(0, line.expected_qty - line.scanned_qty);

        return (
          <li
            key={line.id}
            className={`rounded-xl border bg-slate-900/50 p-3 ${
              surplus
                ? "border-amber-500/50 ring-1 ring-amber-500/20"
                : "border-slate-800"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{line.raw_name}</p>
                <p className="font-mono text-xs text-slate-500">
                  {line.ean ?? "EAN au scan"}
                </p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-bold uppercase ${state.className}`}
              >
                {state.label}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
              <span>
                Scanné / attendu :{" "}
                <strong className={surplus ? "text-amber-400" : "text-white"}>
                  {line.scanned_qty} / {line.expected_qty}
                </strong>
              </span>
              {line.expected_qty > 0 && !surplus && (
                <span>
                  Reste : <strong className="text-amber-400">{rest}</strong>
                </span>
              )}
              {surplus && (
                <span>
                  Surplus :{" "}
                  <strong className="text-amber-400">
                    +{line.scanned_qty - line.expected_qty}
                  </strong>
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

            <LineQtyControls
              key={`${line.id}-${line.scanned_qty}`}
              line={line}
              disabled={disabled}
              isAdjusting={adjustingLineId === line.id}
              onAdjust={onAdjustQty}
              onReset={onResetLine}
            />
          </li>
        );
      })}
    </ul>
  );
}

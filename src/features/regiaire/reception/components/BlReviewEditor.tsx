"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import type { DeliveryLineRow } from "@/features/regiaire/reception/schemas";
import { createClient } from "@/utils/supabase/client";

export function BlReviewEditor({
  deliveryId,
  onConfirmed,
}: {
  deliveryId: string;
  onConfirmed: () => void;
}) {
  const [lines, setLines] = useState<DeliveryLineRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLines = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("delivery_lines")
      .select(
        "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc"
      )
      .eq("delivery_id", deliveryId)
      .order("raw_name");

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setLines((data ?? []) as DeliveryLineRow[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadLines();
  }, [deliveryId]);

  const updateLine = (id: string, patch: Partial<DeliveryLineRow>) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  };

  const saveAndConfirm = async () => {
    setIsSaving(true);
    setError(null);
    const supabase = createClient();

    for (const line of lines) {
      const { error: updateError } = await supabase
        .from("delivery_lines")
        .update({
          raw_name: line.raw_name,
          expected_qty: line.expected_qty,
          dlc: line.dlc,
        })
        .eq("id", line.id);

      if (updateError) {
        setError(updateError.message);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    onConfirmed();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h2 className="text-lg font-bold text-white">Revue du bon de livraison</h2>
        <p className="text-sm text-slate-400">
          Vérifiez et corrigez les lignes extraites avant le scan.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {lines.map((line) => (
          <li
            key={line.id}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-2"
          >
            <input
              value={line.raw_name}
              onChange={(e) => updateLine(line.id, { raw_name: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <p className="font-mono text-xs text-slate-500">EAN {line.ean}</p>
            <div className="flex gap-2">
              <label className="flex-1 text-[10px] uppercase text-slate-500">
                Qté attendue
                <input
                  type="number"
                  min={0}
                  value={line.expected_qty}
                  onChange={(e) =>
                    updateLine(line.id, {
                      expected_qty: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </label>
              <label className="flex-1 text-[10px] uppercase text-slate-500">
                DLC
                <input
                  type="date"
                  value={line.dlc ?? ""}
                  onChange={(e) =>
                    updateLine(line.id, { dlc: e.target.value || null })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      {lines.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Trash2 size={16} /> Aucune ligne extraite.
        </p>
      )}

      <button
        type="button"
        onClick={() => void saveAndConfirm()}
        disabled={isSaving || lines.length === 0}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-4 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
      >
        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
        Confirmer et passer au scan
      </button>
    </div>
  );
}

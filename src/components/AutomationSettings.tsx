// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, ShieldOff } from "lucide-react";
import type { AutomationPolicyRow } from "@/types/database.types";

interface AutomationSettingsProps {
  userId: string;
}

export function AutomationSettings({ userId }: AutomationSettingsProps) {
  const [items, setItems] = useState<AutomationPolicyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEnabled = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/automation-policies/enabled?user_id=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erreur ${res.status}`);
      }
      const data = await res.json();
      setItems((data.items ?? []) as AutomationPolicyRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEnabled();
  }, [fetchEnabled]);

  const handleRevoke = async (id: string) => {
    if (!confirm("Révoquer l’Auto-Pilot pour cette action ? Les validations repasseront par la file.")) return;
    setRevokingId(id);
    setError(null);
    try {
      const res = await fetch("/api/automation-policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "DECLINED_100" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la révocation");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="mt-12 pt-8 border-t border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Paramètres d’automatisation</h2>
        <button
          type="button"
          onClick={fetchEnabled}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : undefined} />
          Actualiser
        </button>
      </div>
      <p className="text-slate-400 text-sm mb-6">
        Actions pour lesquelles l’Auto-Pilot est activé (validation automatique sans file). Révoquer pour repasser par la file de validation.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          Chargement…
        </div>
      ) : items.length === 0 ? (
        <p className="text-slate-500 text-sm py-4">Aucune politique Auto-Pilot activée.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((policy) => (
            <li
              key={policy.id}
              className="flex items-center justify-between gap-4 bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3"
            >
              <span className="font-medium text-white">{policy.action_type}</span>
              <button
                type="button"
                onClick={() => handleRevoke(policy.id)}
                disabled={revokingId === policy.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-red-900/40 border border-slate-600 hover:border-red-500/50 rounded-lg text-slate-200 text-sm transition disabled:opacity-50"
              >
                {revokingId === policy.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ShieldOff size={14} />
                )}
                Révoquer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

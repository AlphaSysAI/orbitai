"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Inbox } from "lucide-react";

export interface ValidationQueueItem {
  id: string;
  event_id: string;
  action: string;
  payload: Record<string, unknown>;
  rationale: string;
  human_input_required: boolean;
  status: string;
  created_at: string;
}

interface ValidationDashboardProps {
  userId: string;
}

export function ValidationDashboard({ userId }: ValidationDashboardProps) {
  const [items, setItems] = useState<ValidationQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review/queue");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erreur ${res.status}`);
      }
      const data = await res.json();
      setItems((data.items ?? []) as ValidationQueueItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleValidate = async (taskId: string, status: "approved" | "rejected") => {
    setValidatingId(taskId);
    setError(null);
    try {
      const res = await fetch("/api/tasks/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, status, user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setItems((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la révision");
    } finally {
      setValidatingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-white italic tracking-tighter uppercase">
            Révisions IA
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Propositions générées par l&apos;IA en attente de validation humaine
          </p>
        </div>
        <button
          type="button"
          onClick={fetchQueue}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition disabled:opacity-50"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : undefined} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20 text-slate-400">
          <Loader2 size={32} className="animate-spin mr-2" />
          Chargement des révisions…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Inbox size={48} className="mb-4 opacity-50" />
          <p className="text-lg">Aucune proposition en attente de révision</p>
        </div>
      ) : (
        <ul className="space-y-6">
          {items.map((item) => (
            <li
              key={item.id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-500">{item.event_id}</span>
                    <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 text-xs font-medium">
                      {item.action}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                    Résumé IA
                  </p>
                  <p className="text-white text-sm mb-3 whitespace-pre-wrap">{item.rationale}</p>
                  {Object.keys(item.payload ?? {}).length > 0 && (
                    <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                        Contenu proposé
                      </p>
                      <pre className="text-slate-300 text-xs overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                  <p className="text-slate-500 text-xs mt-2">
                    {new Date(item.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleValidate(item.id, "approved")}
                    disabled={validatingId === item.id}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {validatingId === item.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Approuver
                  </button>
                  <button
                    type="button"
                    onClick={() => handleValidate(item.id, "rejected")}
                    disabled={validatingId === item.id}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-red-900/50 border border-slate-600 hover:border-red-500/50 rounded-lg text-slate-200 text-sm transition disabled:opacity-50"
                  >
                    {validatingId === item.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <XCircle size={16} />
                    )}
                    Rejeter
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

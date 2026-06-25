// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Search, Star, Unlink } from "lucide-react";

type SyncState = {
  connected: boolean;
  placeName: string | null;
  placeId: string | null;
  hasKey: boolean;
  lastSyncAt: string | null;
  newReviewsCount: number;
  totalReviewsSynced: number;
};

type PlaceResult = {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  totalRatings?: number;
};

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 placeholder:text-slate-600";

export function GoogleReviewSettings() {
  const [state, setState] = useState<SyncState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [apiKey, setApiKey] = useState("");
  const [businessQuery, setBusinessQuery] = useState("");
  const [searchResult, setSearchResult] = useState<PlaceResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/user/review-settings");
      if (res.ok) {
        const data = await res.json() as SyncState;
        setState(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  const handleSearch = async () => {
    if (!apiKey.trim() || !businessQuery.trim()) {
      setError("Renseignez la clé API et le nom de l'établissement.");
      return;
    }
    setIsSearching(true);
    setError(null);
    setSearchResult(null);

    try {
      const res = await fetch("/api/user/review-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search", apiKey: apiKey.trim(), businessQuery: businessQuery.trim() }),
      });
      const data = await res.json() as { place?: PlaceResult; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Recherche échouée");
        return;
      }
      if (data.place) setSearchResult(data.place);
    } catch {
      setError("Erreur réseau lors de la recherche.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleConnect = async () => {
    if (!searchResult) return;
    setIsConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/user/review-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect",
          apiKey: apiKey.trim(),
          placeId: searchResult.placeId,
          placeName: searchResult.name,
        }),
      });
      const data = await res.json() as { success?: boolean; newReviews?: number; total?: number; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Connexion échouée");
        return;
      }
      setSuccess(`Connecté ! ${data.total ?? 0} avis importés.`);
      setApiKey("");
      setBusinessQuery("");
      setSearchResult(null);
      await fetchState();
    } catch {
      setError("Erreur réseau lors de la connexion.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/user/review-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json() as { success?: boolean; newReviews?: number; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Sync échoué"); return; }
      setSuccess(data.newReviews ? `${data.newReviews} nouveau(x) avis récupéré(s).` : "Aucun nouvel avis.");
      await fetchState();
    } catch {
      setError("Erreur réseau.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/user/review-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect" }),
    });
    if (res.ok) {
      setSuccess("Déconnecté.");
      await fetchState();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <section className="rounded-[2rem] border border-slate-800/50 bg-slate-900/40 p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Star size={18} className="text-yellow-400" />
            Avis Google
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Connectez votre fiche Google pour synchroniser les avis automatiquement chaque mois.
          </p>
        </div>
        {state?.connected && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-600/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">
            <CheckCircle2 size={12} />
            Connecté
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-600/10 px-4 py-2 text-sm text-emerald-300">
          {success}
        </p>
      )}

      {state?.connected ? (
        /* ── État connecté ── */
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Établissement" value={state.placeName ?? "—"} />
            <Stat label="Avis importés" value={state.totalReviewsSynced.toLocaleString("fr-FR")} />
            <Stat label="Dernière sync" value={state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleDateString("fr-FR") : "—"} />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-slate-600 disabled:opacity-50"
            >
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Synchroniser maintenant
            </button>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              className="inline-flex items-center gap-2 rounded-xl border border-red-800/40 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-red-400 hover:border-red-600/50"
            >
              <Unlink size={14} />
              Déconnecter
            </button>
          </div>
        </div>
      ) : (
        /* ── Formulaire de connexion ── */
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Clé API Google Places *</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className={inputClass}
                placeholder="AIzaSy..."
              />
              <span className="text-[10px] text-slate-600">
                Google Cloud Console → APIs &amp; Services → Credentials → Créer une clé (Places API activée + facturation)
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nom de l'établissement *</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={businessQuery}
                  onChange={(e) => setBusinessQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSearch(); }}
                  className={inputClass}
                  placeholder="Ex. Avia Corbières Sud"
                />
                <button
                  type="button"
                  onClick={() => void handleSearch()}
                  disabled={isSearching || !apiKey || !businessQuery}
                  className="flex-none rounded-xl bg-slate-800 p-3 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                >
                  {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </div>
            </label>
          </div>

          {searchResult && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-600/5 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-violet-400">Établissement trouvé</p>
              <div>
                <p className="font-semibold text-white">{searchResult.name}</p>
                <p className="text-sm text-slate-400">{searchResult.address}</p>
                {searchResult.totalRatings !== undefined && (
                  <p className="mt-1 text-xs text-slate-500">
                    {searchResult.rating?.toFixed(1)} ★ · {searchResult.totalRatings.toLocaleString("fr-FR")} avis Google
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleConnect()}
                disabled={isConnecting}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {isConnecting ? "Import en cours…" : "Connecter et importer les avis"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white truncate">{value}</p>
    </div>
  );
}

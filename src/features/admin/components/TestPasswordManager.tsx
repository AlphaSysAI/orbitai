// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  KeyRound,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  Users,
} from "lucide-react";

type TestAccount = {
  userId: string;
  email: string | null;
  lastSignInAt: string | null;
  createdAt: string | null;
};

type ResetResult = { userId: string; email: string | null; password: string };

type ListResponse = { enabled?: boolean; accounts?: TestAccount[]; error?: string };
type OneResponse = { result?: ResetResult; error?: string };
type AllResponse = { results?: ResetResult[]; error?: string };

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
      title="Copier"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      {copied ? "Copié" : "Copier"}
    </button>
  );
}

export function TestPasswordManager() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<TestAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Mot de passe généré/défini par compte (affiché en clair après reset).
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  // Saisie optionnelle d'un mot de passe précis par compte.
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/test-passwords", { cache: "no-store" });
      const data = (await res.json()) as ListResponse;
      if (res.status === 403) {
        setEnabled(false);
        setError(data.error ?? "Fonction indisponible");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Erreur de chargement");
      setEnabled(true);
      setAccounts(data.accounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetOne = async (userId: string) => {
    setBusyUserId(userId);
    setError(null);
    try {
      const typed = inputs[userId]?.trim() ?? "";
      const password = typed.length > 0 ? typed : undefined;
      const res = await fetch("/api/admin/test-passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...(password ? { password } : {}) }),
      });
      const data = (await res.json()) as OneResponse;
      if (!res.ok) throw new Error(data.error ?? "Échec de la réinitialisation");
      if (data.result) {
        const pwd = data.result.password;
        setPasswords((p) => ({ ...p, [userId]: pwd }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la réinitialisation");
    } finally {
      setBusyUserId(null);
    }
  };

  const resetAll = async () => {
    if (
      !window.confirm(
        "Attribuer un NOUVEAU mot de passe unique à TOUS les comptes ? Les mots de passe actuels seront écrasés."
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/test-passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = (await res.json()) as AllResponse;
      if (!res.ok) throw new Error(data.error ?? "Échec de la réinitialisation globale");
      const results = data.results ?? [];
      const map: Record<string, string> = {};
      for (const r of results) map[r.userId] = r.password;
      setPasswords(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la réinitialisation globale");
    } finally {
      setBulkBusy(false);
    }
  };

  const copyAll = () => {
    const lines = accounts
      .filter((a) => passwords[a.userId])
      .map((a) => `${a.email ?? a.userId}\t${passwords[a.userId]}`)
      .join("\n");
    if (lines) void navigator.clipboard.writeText(lines);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-wider text-white">
            <KeyRound size={20} className="text-violet-400" />
            Mots de passe de test
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Réinitialise à la volée un mot de passe unique pour chaque compte.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw size={14} /> Rafraîchir
        </button>
      </header>

      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
        <span>
          Outil de <strong>test</strong> uniquement. Les mots de passe s&apos;affichent en
          clair. Nécessite <code className="font-mono">ALLOW_TEST_PASSWORD_RESET=true</code> et
          un accès administrateur.
        </span>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      ) : enabled === false ? null : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void resetAll()}
              disabled={bulkBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
              Nouveau mot de passe unique pour tous
            </button>
            {Object.keys(passwords).length > 0 && (
              <button
                type="button"
                onClick={copyAll}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                <Copy size={14} /> Copier tout (email + mot de passe)
              </button>
            )}
          </div>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-slate-300">
              <Users size={16} />
              <h3 className="text-sm font-black uppercase tracking-wider">
                Comptes ({accounts.length})
              </h3>
            </div>

            {accounts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun compte.</p>
            ) : (
              <div className="space-y-3">
                {accounts.map((a) => {
                  const pwd = passwords[a.userId];
                  const busy = busyUserId === a.userId;
                  return (
                    <div
                      key={a.userId}
                      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {a.email ?? "(sans email)"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Dernière connexion :{" "}
                          {a.lastSignInAt
                            ? new Date(a.lastSignInAt).toLocaleString("fr-FR")
                            : "jamais"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {pwd ? (
                          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5">
                            <span className="font-mono text-sm text-emerald-200">{pwd}</span>
                            <CopyButton value={pwd} />
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={inputs[a.userId] ?? ""}
                            onChange={(e) =>
                              setInputs((s) => ({ ...s, [a.userId]: e.target.value }))
                            }
                            placeholder="(auto si vide)"
                            className="w-40 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white placeholder:text-slate-600"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => void resetOne(a.userId)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-600 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <RefreshCw size={13} />
                          )}
                          Réinitialiser
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

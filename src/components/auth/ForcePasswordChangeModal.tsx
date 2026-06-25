// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";

import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-change";
import { createClient } from "@/utils/supabase/client";

type ForcePasswordChangeModalProps = {
  onComplete: () => void;
};

export function ForcePasswordChangeModal({
  onComplete,
}: ForcePasswordChangeModalProps) {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsSaving(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });

    setIsSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-password-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0f172a] p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-purple-600/20 p-3">
            <Lock className="text-purple-400" size={24} />
          </div>
          <div>
            <h2
              id="force-password-title"
              className="text-xl font-bold text-white"
            >
              Changez votre mot de passe
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Première connexion — choisissez un mot de passe personnel.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Field label="Nouveau mot de passe">
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder={`Minimum ${MIN_PASSWORD_LENGTH} caractères`}
            />
          </Field>

          <Field label="Confirmer le mot de passe">
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </Field>

          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            Enregistrer le mot de passe
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-purple-500";

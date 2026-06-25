// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-change";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setEmail(data.user.email ?? null);
      setIsLoading(false);
    });
  }, [router, supabase]);

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

    router.replace("/");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#020617]">
        <Loader2 className="animate-spin text-purple-400" size={32} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0f172a] p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-purple-600/20 p-3">
            <Lock className="text-purple-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Créez votre mot de passe
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Bienvenue sur OrbitAI — choisissez un mot de passe pour votre compte.
            </p>
          </div>
        </div>

        {email && (
          <div className="mb-5 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Compte
            </p>
            <p className="mt-0.5 text-sm text-white">{email}</p>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Mot de passe
            </span>
            <input
              type="password"
              required
              autoFocus
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Minimum ${MIN_PASSWORD_LENGTH} caractères`}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-purple-500 placeholder:text-slate-600"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Confirmer le mot de passe
            </span>
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            Enregistrer et accéder à l&apos;application
          </button>
        </form>
      </div>
    </div>
  );
}

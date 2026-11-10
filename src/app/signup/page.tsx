// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, Orbit } from "lucide-react";

import { createClient } from "@/utils/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [companyName, setCompanyName] = useState("");
  const [businessSector, setBusinessSector] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          businessSector,
          firstName,
          lastName,
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);

      // Connexion immédiate avec les identifiants choisis.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        // Compte créé mais connexion auto échouée : on bascule sur le login.
        router.push("/login");
        return;
      }
      // Nouveau client sans abonnement → on l'emmène choisir ses features.
      router.push("/abonnements");
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Erreur lors de l'inscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 text-sm font-black uppercase italic tracking-tighter text-white"
        >
          <span className="rounded-lg bg-violet-600 p-1.5">
            <Orbit size={16} className="text-white" />
          </span>
          OrbitAll
        </Link>

        <h1 className="text-2xl font-black uppercase tracking-tight text-white">
          Créer votre compte
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Lancez votre espace en 1 minute. Vous choisirez vos features juste après —
          sans engagement, modifiable à tout moment.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entreprise *" className="sm:col-span-2">
              <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} placeholder="Groupe Les Oliviers" />
            </Field>
            <Field label="Secteur d'activité" className="sm:col-span-2">
              <input value={businessSector} onChange={(e) => setBusinessSector(e.target.value)} className={inputClass} placeholder="Station-service, hôtellerie…" />
            </Field>
            <Field label="Prénom *">
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} placeholder="Jean" />
            </Field>
            <Field label="Nom *">
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} placeholder="Dupont" />
            </Field>
            <Field label="Email professionnel *" className="sm:col-span-2">
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="jean.dupont@entreprise.fr" />
            </Field>
            <Field label="Mot de passe *" className="sm:col-span-2">
              <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="8 caractères minimum" />
            </Field>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            Créer mon compte
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-bold text-violet-400 hover:text-violet-300">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 placeholder:text-slate-600";

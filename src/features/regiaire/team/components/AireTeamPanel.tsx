// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";

import { useRegiaireAireId } from "@/features/regiaire/hooks/useRegiaireAireId";
import {
  createAireTeamEmployee,
  listAireTeam,
  removeAireTeamEmployee,
} from "@/features/regiaire/team/actions";
import { EquipeSubNav } from "@/features/regiaire/shift/components/EquipeSubNav";
import { getShiftMemberRole } from "@/features/regiaire/shift/actions";

type TeamMember = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-slate-600 focus:outline-none";

export function AireTeamPanel() {
  const aireId = useRegiaireAireId();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const roleRes = await getShiftMemberRole(aireId);
    if (!roleRes.success) {
      setError(roleRes.error);
      setIsLoading(false);
      return;
    }

    setIsAdmin(roleRes.isAdmin);
    if (!roleRes.isAdmin) {
      setError("Accès réservé au gérant ou à l'administration.");
      setIsLoading(false);
      return;
    }

    const res = await listAireTeam(aireId);
    if (!res.success) {
      setError(res.error);
    } else {
      setMembers(res.data);
    }
    setIsLoading(false);
  }, [aireId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const res = await createAireTeamEmployee(aireId, {
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setSuccess(`Compte créé : ${res.data.email}`);
    setEmail("");
    setFirstName("");
    setLastName("");
    await load();
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Retirer cet employé de l'aire ? Son compte sera supprimé s'il n'est rattaché à aucune autre aire.")) {
      return;
    }

    setRemovingId(userId);
    setError(null);
    setSuccess(null);

    const res = await removeAireTeamEmployee(aireId, userId);
    setRemovingId(null);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setSuccess("Employé retiré.");
    await load();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Users className="text-purple-400" size={22} />
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-700">
              Équipe
            </p>
            <h1 className="text-xl font-black uppercase tracking-tight text-white">
              Employés de l&apos;aire
            </h1>
          </div>
        </div>
        <EquipeSubNav aireId={aireId} isAdmin={isAdmin} />
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-300">
          {success}
        </p>
      )}

      {isAdmin && (
        <>
          <ul className="space-y-2">
            {members.length === 0 ? (
              <li className="rounded-xl border border-dashed border-slate-800 py-8 text-center text-sm text-slate-600">
                Aucun employé rattaché à cette aire.
              </li>
            ) : (
              members.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {m.firstName || m.lastName
                        ? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()
                        : m.email ?? m.userId.slice(0, 8)}
                    </p>
                    {m.email && (
                      <p className="truncate text-xs text-slate-500">{m.email}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={removingId === m.userId}
                    onClick={() => void handleRemove(m.userId)}
                    className="shrink-0 rounded-lg border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    aria-label="Retirer l'employé"
                  >
                    {removingId === m.userId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>

          <form
            onSubmit={(e) => void handleCreate(e)}
            className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
          >
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <UserPlus size={16} className="text-amber-400" />
              Nouvel employé
            </h2>
            <p className="text-xs text-slate-500">
              L&apos;employé accède uniquement aux réceptions et à la passation
              de quart sur cette aire. Mot de passe initial standard de
              l&apos;organisation.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Email *
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Prénom
                </span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Nom
                </span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              Créer le compte employé
            </button>
          </form>
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";

import {
  createOrgMember,
  getOrgSettings,
  updateOrgProfile,
  type OrgMemberListItem,
  type OrgProfile,
} from "@/features/organization/actions";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
};

export function OrganizationSettingsPanel() {
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [members, setMembers] = useState<OrgMemberListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getOrgSettings();
    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
      return;
    }
    setProfile(result.data.profile);
    setMembers(result.data.members);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const result = await updateOrgProfile({
      name: profile.name,
      managerFirstName: profile.managerFirstName ?? "",
      managerLastName: profile.managerLastName ?? "",
      managerEmail: profile.managerEmail ?? "",
      businessSector: profile.businessSector ?? "",
    });

    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setProfile(result.data);
    setSuccess("Profil entreprise enregistré.");
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const result = await createOrgMember({
      email: newEmail,
      password: newPassword,
      firstName: newFirstName || undefined,
      lastName: newLastName || undefined,
    });

    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setNewEmail("");
    setNewPassword("");
    setNewFirstName("");
    setNewLastName("");
    setSuccess(`Compte membre créé pour ${result.data.email}.`);
    await load();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-purple-400" size={32} />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
        {error}
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-10">
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

      <section className="rounded-[2rem] border border-slate-800/50 bg-slate-900/40 p-8">
        <h2 className="text-lg font-bold text-white">Profil entreprise</h2>
        <p className="mt-1 text-sm text-slate-400">
          Informations de votre organisation.
        </p>
        <form onSubmit={(e) => void handleSaveProfile(e)} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Raison sociale" className="sm:col-span-2">
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Prénom responsable">
            <input
              value={profile.managerFirstName ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, managerFirstName: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Nom responsable">
            <input
              value={profile.managerLastName ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, managerLastName: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Email responsable">
            <input
              type="email"
              value={profile.managerEmail ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, managerEmail: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Secteur d'activité">
            <input
              value={profile.businessSector ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, businessSector: e.target.value })
              }
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
            >
              {isSaving ? "Enregistrement…" : "Enregistrer le profil"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] border border-slate-800/50 bg-slate-900/40 p-8">
        <div className="flex items-center gap-3">
          <Users className="text-purple-400" size={22} />
          <div>
            <h2 className="text-lg font-bold text-white">Équipe</h2>
            <p className="text-sm text-slate-400">
              Membres sans accès aux réglages ni à la config Équipe.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm"
            >
              <span className="font-mono text-xs text-slate-500 truncate max-w-[200px]">
                {m.userId.slice(0, 8)}…
              </span>
              <span className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">
                {ROLE_LABELS[m.role] ?? m.role}
              </span>
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => void handleCreateMember(e)}
          className="mt-6 space-y-4 border-t border-slate-800 pt-6"
        >
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <UserPlus size={16} className="text-amber-400" />
            Nouveau membre
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email *">
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Mot de passe * (min. 8 car.)">
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Prénom">
              <input
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Nom">
              <input
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            Créer le compte membre
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500";

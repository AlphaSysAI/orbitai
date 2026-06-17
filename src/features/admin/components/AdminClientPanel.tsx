"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Loader2, Plus, Users } from "lucide-react";

import { ORG_MODULE_CATALOG } from "@/lib/organizations/module-catalog";

type ClientRow = {
  id: string;
  name: string;
  managerFirstName: string | null;
  managerLastName: string | null;
  managerEmail: string | null;
  businessSector: string | null;
  createdAt: string;
  enabledModules: string[];
};

type CreateResult = {
  organizationId: string;
  managerEmail: string;
  temporaryPassword: string;
  enabledModules: string[];
};

const BUSINESS_SECTOR_SUGGESTIONS = [
  "Station-service",
  "Distribution carburants",
  "Commerce de détail",
  "Restauration",
  "Industrie",
  "Services B2B",
  "Santé",
  "Immobilier",
  "Transport & logistique",
];

const moduleLabel = (id: string) =>
  ORG_MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;

export function AdminClientPanel() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateResult | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [businessSector, setBusinessSector] = useState("");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setClients(data.clients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          managerFirstName,
          managerLastName,
          managerEmail,
          businessSector,
          moduleNames: Array.from(selectedModules),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);

      setSuccess(data.client as CreateResult);
      setCompanyName("");
      setManagerFirstName("");
      setManagerLastName("");
      setManagerEmail("");
      setBusinessSector("");
      setSelectedModules(new Set());
      await loadClients();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur création");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          Gestion des clients
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Créez une organisation, le compte du responsable et activez les modules auxquels il aura accès.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 space-y-8"
      >
        <div className="flex items-center gap-2 text-violet-400">
          <Plus size={18} />
          <h3 className="text-sm font-black uppercase tracking-wider">Nouveau client</h3>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Nom de l'entreprise *">
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
              placeholder="Ex. Station Total Les Oliviers"
            />
          </Field>

          <Field label="Métier / secteur *">
            <input
              required
              list="business-sectors"
              value={businessSector}
              onChange={(e) => setBusinessSector(e.target.value)}
              className={inputClass}
              placeholder="Ex. Station-service"
            />
            <datalist id="business-sectors">
              {BUSINESS_SECTOR_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>

          <Field label="Prénom du responsable *">
            <input
              required
              value={managerFirstName}
              onChange={(e) => setManagerFirstName(e.target.value)}
              className={inputClass}
              placeholder="Jean"
            />
          </Field>

          <Field label="Nom du responsable *">
            <input
              required
              value={managerLastName}
              onChange={(e) => setManagerLastName(e.target.value)}
              className={inputClass}
              placeholder="Dupont"
            />
          </Field>

          <Field label="Email du responsable (connexion) *" className="md:col-span-2">
            <input
              required
              type="email"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              className={inputClass}
              placeholder="jean.dupont@entreprise.fr"
            />
          </Field>
        </div>

        <div>
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Modules activés
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ORG_MODULE_CATALOG.map((mod) => {
              const checked = selectedModules.has(mod.id);
              return (
                <label
                  key={mod.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    checked
                      ? "border-violet-500/50 bg-violet-600/10"
                      : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleModule(mod.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-600 focus:ring-violet-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">{mod.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{mod.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {success && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200 space-y-2">
            <p className="flex items-center gap-2 font-semibold text-emerald-300">
              <CheckCircle2 size={16} />
              Client créé avec succès
            </p>
            <p>
              Email : <strong>{success.managerEmail}</strong>
            </p>
            <p>
              Mot de passe temporaire :{" "}
              <code className="rounded bg-slate-900 px-2 py-1 text-emerald-100">{success.temporaryPassword}</code>
            </p>
            <p className="text-xs text-emerald-400/80">
              Communiquez ce mot de passe au responsable — il pourra le modifier après connexion.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
          Créer le client
        </button>
      </form>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <div className="mb-6 flex items-center gap-2 text-slate-300">
          <Users size={18} />
          <h3 className="text-sm font-black uppercase tracking-wider">Clients existants</h3>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Chargement…
          </div>
        ) : clients.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun client pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4">Entreprise</th>
                  <th className="pb-3 pr-4">Responsable</th>
                  <th className="pb-3 pr-4">Métier</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3">Modules</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-slate-800/60 text-slate-300">
                    <td className="py-4 pr-4 font-medium text-white">{client.name}</td>
                    <td className="py-4 pr-4">
                      {[client.managerFirstName, client.managerLastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="py-4 pr-4">{client.businessSector ?? "—"}</td>
                    <td className="py-4 pr-4 text-slate-400">{client.managerEmail ?? "—"}</td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-1">
                        {client.enabledModules.length === 0 ? (
                          <span className="text-slate-600 text-xs">Aucun</span>
                        ) : (
                          client.enabledModules.map((m) => (
                            <span
                              key={m}
                              className="rounded-full bg-violet-600/15 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-300"
                            >
                              {moduleLabel(m)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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

// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Wrench } from "lucide-react";

import {
  createService,
  deleteService,
  getArtisanSettings,
  updateArtisanProfile,
  type ArtisanService,
} from "@/features/artisan/services/actions";

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600";

const eurFromCents = (c: number | null) =>
  c === null ? "Sur devis" : (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function ArtisanSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [laborRate, setLaborRate] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [services, setServices] = useState<ArtisanService[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("60");
  const [newPrice, setNewPrice] = useState("");
  const [isAddingService, setIsAddingService] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await getArtisanSettings();
    if (result.success) {
      setBusinessName(result.data.profile.businessName);
      setDescription(result.data.profile.description ?? "");
      setLaborRate(
        result.data.profile.laborRatePerHourCents != null
          ? String(result.data.profile.laborRatePerHourCents / 100)
          : ""
      );
      setServices(result.data.services);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    setError(null);
    setSuccess(null);
    const laborRateEur = laborRate.trim() === "" ? null : Number.parseFloat(laborRate);
    const result = await updateArtisanProfile({ businessName, description, laborRateEur });
    setIsSavingProfile(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccess("Profil enregistré.");
  };

  const handleAddService = async () => {
    setIsAddingService(true);
    setError(null);
    const priceEur = newPrice.trim() === "" ? null : Number.parseFloat(newPrice);
    const result = await createService({
      title: newTitle,
      durationMinutes: Number.parseInt(newDuration, 10),
      priceEur,
    });
    setIsAddingService(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNewTitle("");
    setNewDuration("60");
    setNewPrice("");
    await load();
  };

  const handleDeleteService = async (id: string) => {
    const result = await deleteService(id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-orange-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          <Wrench size={26} className="text-orange-400" />
          Réglages artisan
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Profil, taux horaire et catalogue de prestations (utilisés par l&apos;IA de devis).
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">Profil</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 sm:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Nom de l&apos;entreprise
            </span>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
          </label>
          <label className="block space-y-2 sm:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="Ex. Plombier chauffagiste, 15 ans d'expérience"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Taux horaire (€/h)
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={laborRate}
              onChange={(e) => setLaborRate(e.target.value)}
              className={inputClass}
              placeholder="45"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveProfile()}
          disabled={isSavingProfile}
          className="rounded-xl bg-orange-600 px-6 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-orange-500 disabled:opacity-50"
        >
          {isSavingProfile ? "Enregistrement…" : "Enregistrer le profil"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-6">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">Prestations</h3>

        {services.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune prestation. Ajoutez-en pour guider l&apos;IA.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">{s.title}</p>
                  <p className="text-xs text-slate-500">
                    {s.durationMinutes} min · {eurFromCents(s.priceCents)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteService(s.id)}
                  className="rounded-lg border border-red-800/50 p-2 text-red-400 hover:border-red-500/60 hover:text-red-300"
                  aria-label="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Titre</span>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={inputClass}
              placeholder="Ex. Pose de robinetterie"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Durée (min)</span>
            <input
              type="number"
              min={1}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Prix (€)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className={inputClass}
              placeholder="Sur devis"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleAddService()}
            disabled={isAddingService}
            className="flex h-[46px] items-center gap-2 rounded-xl bg-slate-700 px-5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-slate-600 disabled:opacity-50"
          >
            {isAddingService ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Ajouter
          </button>
        </div>
      </section>
    </div>
  );
}

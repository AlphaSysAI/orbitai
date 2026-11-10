// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { BedDouble, Loader2, Network, Plus, Trash2 } from "lucide-react";

import {
  createRoom,
  createRoomType,
  deleteRoom,
  getHotelInventory,
  type Room,
  type RoomType,
} from "@/features/hotel/inventory/actions";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 placeholder:text-slate-600";

const eurFromCents = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function HotelInventoryManager() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tCode, setTCode] = useState("");
  const [tNom, setTNom] = useState("");
  const [tCap, setTCap] = useState("2");
  const [tRate, setTRate] = useState("");
  const [addingType, setAddingType] = useState(false);

  const [rNum, setRNum] = useState("");
  const [rEtage, setREtage] = useState("");
  const [rType, setRType] = useState("");
  const [addingRoom, setAddingRoom] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await getHotelInventory();
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRoomTypes(result.data.roomTypes);
    setRooms(result.data.rooms);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addType = async () => {
    setAddingType(true);
    setError(null);
    const result = await createRoomType({
      code: tCode,
      nom: tNom,
      capacityAdults: Number.parseInt(tCap, 10) || 0,
      defaultRateEur: Number.parseFloat(tRate) || 0,
    });
    setAddingType(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setTCode("");
    setTNom("");
    setTCap("2");
    setTRate("");
    await load();
  };

  const addRoom = async () => {
    setAddingRoom(true);
    setError(null);
    const result = await createRoom({ numero: rNum, etage: rEtage || null, roomTypeId: rType });
    setAddingRoom(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRNum("");
    setREtage("");
    await load();
  };

  const removeRoom = async (id: string) => {
    const result = await deleteRoom(id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRooms((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          <Network size={26} className="text-sky-400" />
          Orbit Hôtel — Inventaire
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Types de chambres et chambres physiques. Socle du PMS (réservations, tarifs et
          facturation à venir).
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {/* Types de chambres */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-5">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">Types de chambres</h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : roomTypes.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun type. Ajoutez-en un pour créer des chambres.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {roomTypes.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">
                    {t.nom} <span className="text-slate-500">· {t.code}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {t.capacityAdults} adulte{t.capacityAdults > 1 ? "s" : ""} · {eurFromCents(t.defaultRateCents)}/nuit
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1.5fr_80px_100px_auto]">
          <LabeledInput label="Code" value={tCode} onChange={setTCode} placeholder="DBL" />
          <LabeledInput label="Nom" value={tNom} onChange={setTNom} placeholder="Chambre double" />
          <LabeledInput label="Adultes" value={tCap} onChange={setTCap} type="number" />
          <LabeledInput label="Tarif (€)" value={tRate} onChange={setTRate} type="number" placeholder="120" />
          <button
            type="button"
            onClick={() => void addType()}
            disabled={addingType}
            className="flex h-[38px] items-center gap-2 rounded-lg bg-sky-600 px-4 text-[10px] font-black uppercase tracking-wider text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {addingType ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Type
          </button>
        </div>
      </section>

      {/* Chambres */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-5">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
          <BedDouble size={16} /> Chambres
        </h3>
        {!isLoading && rooms.length > 0 && (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {rooms.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">
                    Ch. {r.numero}
                    {r.etage ? <span className="text-slate-500"> · étage {r.etage}</span> : null}
                  </p>
                  <p className="text-xs text-slate-500">{r.roomTypeName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeRoom(r.id)}
                  className="rounded-lg border border-red-800/50 p-2 text-red-400 hover:border-red-500/60"
                  aria-label="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {roomTypes.length === 0 ? (
          <p className="text-sm text-slate-500">Créez d&apos;abord un type de chambre.</p>
        ) : (
          <div className="grid items-end gap-3 sm:grid-cols-[100px_100px_1fr_auto]">
            <LabeledInput label="Numéro" value={rNum} onChange={setRNum} placeholder="101" />
            <LabeledInput label="Étage" value={rEtage} onChange={setREtage} placeholder="1" />
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Type</span>
              <select value={rType} onChange={(e) => setRType(e.target.value)} className={inputClass}>
                <option value="">— Choisir —</option>
                {roomTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.nom}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void addRoom()}
              disabled={addingRoom}
              className="flex h-[38px] items-center gap-2 rounded-lg bg-sky-600 px-4 text-[10px] font-black uppercase tracking-wider text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {addingRoom ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Chambre
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );
}

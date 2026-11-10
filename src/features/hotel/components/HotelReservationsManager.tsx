// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";

import {
  createReservation,
  listReservations,
  type ReservationListItem,
} from "@/features/hotel/reservations/actions";
import { getHotelInventory, type RoomType } from "@/features/hotel/inventory/actions";
import { listRatePlans, type RatePlan } from "@/features/hotel/rates/actions";
import type { HotelReservationStatus } from "@/types/database.types";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 placeholder:text-slate-600";

const eurFromCents = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const STATUS_LABELS: Record<HotelReservationStatus, string> = {
  option: "Option",
  confirmed: "Confirmée",
  checked_in: "Arrivée",
  checked_out: "Départ",
  no_show: "No-show",
  cancelled: "Annulée",
};

type RoomRow = { roomTypeId: string; ratePlanId: string; guestName: string };

export function HotelReservationsManager() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [reservations, setReservations] = useState<ReservationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState("2");
  const [rooms, setRooms] = useState<RoomRow[]>([{ roomTypeId: "", ratePlanId: "", guestName: "" }]);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [invRes, plansRes, resRes] = await Promise.all([
      getHotelInventory(),
      listRatePlans(),
      listReservations(),
    ]);
    setIsLoading(false);
    if (invRes.success) setRoomTypes(invRes.data.roomTypes);
    if (plansRes.success) setRatePlans(plansRes.data);
    if (resRes.success) setReservations(resRes.data);
    else setError(resRes.error);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const result = await createReservation({
      customerName: customerName || null,
      customerEmail: null,
      checkIn,
      checkOut,
      adults: Number.parseInt(adults, 10) || 1,
      children: 0,
      rooms: rooms
        .filter((r) => r.roomTypeId && r.ratePlanId)
        .map((r) => ({ roomTypeId: r.roomTypeId, ratePlanId: r.ratePlanId, guestName: r.guestName || null })),
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccess(`Réservation ${result.data.reference} créée.`);
    setCustomerName("");
    setCheckIn("");
    setCheckOut("");
    setRooms([{ roomTypeId: "", ratePlanId: "", guestName: "" }]);
    await load();
  };

  const canBook = roomTypes.length > 0 && ratePlans.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          <CalendarCheck size={26} className="text-sky-400" />
          Réservations
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Créez un dossier de réservation. Le prix des nuits est calculé depuis le calendrier
          tarifaire (ou le tarif par défaut du type de chambre).
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}
      {success && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 size={16} /> {success}
        </p>
      )}

      {!canBook ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Configurez au moins un type de chambre (Inventaire) et un plan tarifaire (Tarifs) avant de
          réserver.
        </p>
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-5">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">Nouveau dossier</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Labeled label="Client">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} placeholder="Nom" />
            </Labeled>
            <Labeled label="Arrivée">
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputClass} />
            </Labeled>
            <Labeled label="Départ">
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputClass} />
            </Labeled>
            <Labeled label="Adultes">
              <input type="number" min={1} value={adults} onChange={(e) => setAdults(e.target.value)} className={inputClass} />
            </Labeled>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Chambres</p>
            {rooms.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                <select
                  value={row.roomTypeId}
                  onChange={(e) => setRooms((p) => p.map((r, j) => (j === i ? { ...r, roomTypeId: e.target.value } : r)))}
                  className={inputClass}
                >
                  <option value="">Type…</option>
                  {roomTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.nom}</option>
                  ))}
                </select>
                <select
                  value={row.ratePlanId}
                  onChange={(e) => setRooms((p) => p.map((r, j) => (j === i ? { ...r, ratePlanId: e.target.value } : r)))}
                  className={inputClass}
                >
                  <option value="">Tarif…</option>
                  {ratePlans.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.nom}</option>
                  ))}
                </select>
                <input
                  value={row.guestName}
                  onChange={(e) => setRooms((p) => p.map((r, j) => (j === i ? { ...r, guestName: e.target.value } : r)))}
                  placeholder="Occupant (optionnel)"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setRooms((p) => p.filter((_, j) => j !== i))}
                  className="p-2 text-slate-500 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRooms((p) => [...p, { roomTypeId: "", ratePlanId: "", guestName: "" }])}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-sky-300"
            >
              <Plus size={12} /> Chambre
            </button>
          </div>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CalendarCheck size={16} />}
            Créer la réservation
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8">
        <h3 className="mb-6 text-sm font-black uppercase tracking-wider text-slate-300">Réservations</h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : reservations.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune réservation.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {reservations.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/hotel/reservations/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/5"
                >
                  <div>
                    <p className="font-medium text-white">
                      {r.reference}
                      <span className="text-slate-500"> · {r.customerName || "Client"}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(r.checkIn).toLocaleDateString("fr-FR")} → {new Date(r.checkOut).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                      {STATUS_LABELS[r.status]}
                    </span>
                    <strong className="text-white">{eurFromCents(r.totalCents)}</strong>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BedDouble, FileText, Loader2 } from "lucide-react";

import {
  assignRoom,
  getReservation,
  recordPayment,
  updateReservationStatus,
  type ReservationDetail,
} from "@/features/hotel/reservations/actions";
import { generateInvoice } from "@/features/hotel/billing/actions";
import type {
  HotelPaymentKind,
  HotelPaymentMethod,
  HotelReservationStatus,
} from "@/types/database.types";

const METHOD_LABELS: Record<HotelPaymentMethod, string> = {
  cash: "Espèces",
  card: "Carte",
  transfer: "Virement",
  other: "Autre",
};
const KIND_LABELS: Record<HotelPaymentKind, string> = {
  deposit: "Acompte",
  balance: "Solde",
  refund: "Remboursement",
};

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

const NEXT_ACTIONS: Record<HotelReservationStatus, { status: HotelReservationStatus; label: string; cls: string }[]> = {
  option: [
    { status: "confirmed", label: "Confirmer", cls: "bg-sky-600 hover:bg-sky-500" },
    { status: "cancelled", label: "Annuler", cls: "bg-red-600 hover:bg-red-500" },
  ],
  confirmed: [
    { status: "checked_in", label: "Check-in", cls: "bg-emerald-600 hover:bg-emerald-500" },
    { status: "no_show", label: "No-show", cls: "bg-amber-600 hover:bg-amber-500" },
    { status: "cancelled", label: "Annuler", cls: "bg-red-600 hover:bg-red-500" },
  ],
  checked_in: [{ status: "checked_out", label: "Check-out", cls: "bg-emerald-600 hover:bg-emerald-500" }],
  checked_out: [],
  no_show: [],
  cancelled: [],
};

const inputClass =
  "rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-sky-500";

export function HotelReservationDetail({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [res, setRes] = useState<ReservationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payMethod, setPayMethod] = useState<HotelPaymentMethod>("card");
  const [payKind, setPayKind] = useState<HotelPaymentKind>("balance");
  const [payAmount, setPayAmount] = useState("");
  const [payingSaving, setPayingSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await getReservation(reservationId);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setRes(result.data);
  }, [reservationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (status: HotelReservationStatus) => {
    setBusy(true);
    setError(null);
    const result = await updateReservationStatus(reservationId, status);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await load();
  };

  const makeInvoice = async () => {
    setBusy(true);
    setError(null);
    const result = await generateInvoice(reservationId);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/hotel/factures");
  };

  const addPayment = async () => {
    const amount = Number.parseFloat(payAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Montant invalide.");
      return;
    }
    setPayingSaving(true);
    setError(null);
    const result = await recordPayment(reservationId, {
      method: payMethod,
      kind: payKind,
      amountEur: amount,
      note: null,
    });
    setPayingSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setPayAmount("");
    await load();
  };

  const assign = async (reservationRoomId: string, roomId: string) => {
    setError(null);
    const result = await assignRoom(reservationRoomId, roomId || null);
    if (!result.success) {
      setError(result.error);
      await load();
      return;
    }
    await load();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-sky-400" size={32} />
      </div>
    );
  }

  if (!res) {
    return (
      <div className="space-y-4">
        <Link href="/hotel/reservations" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-200">
          <ArrowLeft size={14} /> Réservations
        </Link>
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error ?? "Réservation introuvable"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/hotel/reservations" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-200">
          <ArrowLeft size={14} /> Réservations
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl font-extrabold uppercase italic tracking-tighter text-white">
            {res.reference}
          </h2>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-bold uppercase text-slate-300">
            {STATUS_LABELS[res.status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {res.customerName || "Client"} · {new Date(res.checkIn).toLocaleDateString("fr-FR")} →{" "}
          {new Date(res.checkOut).toLocaleDateString("fr-FR")} · {res.adults} adulte
          {res.adults > 1 ? "s" : ""}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
          <BedDouble size={16} /> Chambres
        </h3>
        <ul className="space-y-3">
          {res.rooms.map((room) => {
            const options = res.roomsByType[room.roomTypeId] ?? [];
            const assignable = res.status !== "cancelled" && res.status !== "no_show";
            return (
              <li key={room.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                <div>
                  <p className="font-medium text-white">
                    {room.roomTypeName}
                    <span className="text-slate-500"> · {room.ratePlanName}</span>
                  </p>
                  <p className="text-xs text-slate-500">{room.guestName || "Occupant non renseigné"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Chambre</span>
                  <select
                    value={room.roomId ?? ""}
                    disabled={!assignable}
                    onChange={(e) => void assign(room.id, e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Non assignée —</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>Ch. {o.numero}</option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-5">
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between text-slate-400"><span>Total</span><span>{eurFromCents(res.totalCents)}</span></div>
          <div className="flex justify-between text-slate-400"><span>Payé</span><span>{eurFromCents(res.paidCents)}</span></div>
          <div className="flex justify-between text-base font-bold text-white"><span>Solde</span><span>{eurFromCents(res.balanceCents)}</span></div>
        </div>

        {res.payments.length > 0 && (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 text-sm">
            {res.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-slate-300">
                  {KIND_LABELS[p.kind]} · {METHOD_LABELS[p.method]}
                  <span className="text-slate-500"> · {new Date(p.createdAt).toLocaleDateString("fr-FR")}</span>
                </span>
                <strong className={p.kind === "refund" ? "text-red-300" : "text-white"}>
                  {p.kind === "refund" ? "−" : ""}
                  {eurFromCents(p.amountCents)}
                </strong>
              </li>
            ))}
          </ul>
        )}

        <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Type</span>
            <select value={payKind} onChange={(e) => setPayKind(e.target.value as HotelPaymentKind)} className={inputClass}>
              {(Object.keys(KIND_LABELS) as HotelPaymentKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABELS[k]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Moyen</span>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as HotelPaymentMethod)} className={inputClass}>
              {(Object.keys(METHOD_LABELS) as HotelPaymentMethod[]).map((m) => (
                <option key={m} value={m}>{METHOD_LABELS[m]}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Montant (€)</span>
            <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputClass} />
          </label>
          <button
            type="button"
            onClick={() => void addPayment()}
            disabled={payingSaving}
            className="flex h-[34px] items-center gap-2 rounded-lg bg-emerald-600 px-4 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {payingSaving ? <Loader2 size={14} className="animate-spin" /> : null} Enregistrer
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          Enregistrement comptable uniquement (pas d&apos;encaissement carte en ligne).
        </p>
        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => void makeInvoice()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-slate-600 disabled:opacity-50"
          >
            <FileText size={14} /> Générer la facture
          </button>
        </div>
      </section>

      {NEXT_ACTIONS[res.status].length > 0 && (
        <section className="flex flex-wrap gap-3">
          {NEXT_ACTIONS[res.status].map((a) => (
            <button
              key={a.status}
              type="button"
              onClick={() => void changeStatus(a.status)}
              disabled={busy}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50 ${a.cls}`}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              {a.label}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

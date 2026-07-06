// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Tag } from "lucide-react";

import { createRatePlan, listRatePlans, type RatePlan } from "@/features/hotel/rates/actions";
import { getHotelInventory, type RoomType } from "@/features/hotel/inventory/actions";
import type { HotelBoard } from "@/types/database.types";

const BOARD_LABELS: Record<HotelBoard, string> = {
  RO: "Sans repas",
  BB: "Petit-déjeuner",
  HB: "Demi-pension",
  FB: "Pension complète",
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500 placeholder:text-slate-600";

export function HotelRatePlansManager() {
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [board, setBoard] = useState<HotelBoard>("RO");
  const [refundable, setRefundable] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const [plansRes, invRes] = await Promise.all([listRatePlans(), getHotelInventory()]);
    setIsLoading(false);
    if (!plansRes.success) {
      setError(plansRes.error);
      return;
    }
    setPlans(plansRes.data);
    if (invRes.success) setRoomTypes(invRes.data.roomTypes);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    setAdding(true);
    setError(null);
    const result = await createRatePlan({
      code,
      nom,
      roomTypeId: roomTypeId || null,
      board,
      refundable,
    });
    setAdding(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setCode("");
    setNom("");
    setRoomTypeId("");
    setBoard("RO");
    setRefundable(true);
    await load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          <Tag size={26} className="text-sky-400" />
          Tarifs
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Plans tarifaires (formule, remboursable, type de chambre). Le prix par jour se gère
          ensuite dans le calendrier.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun plan tarifaire.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">
                    {p.nom} <span className="text-slate-500">· {p.code}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {BOARD_LABELS[p.board]}
                    {p.roomTypeName ? ` · ${p.roomTypeName}` : " · tous types"}
                    {p.refundable ? " · remboursable" : " · non remboursable"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} placeholder="FLEX" />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nom</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className={inputClass} placeholder="Tarif flexible" />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Type (optionnel)</span>
            <select value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} className={inputClass}>
              <option value="">Tous les types</option>
              {roomTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Formule</span>
            <select value={board} onChange={(e) => setBoard(e.target.value as HotelBoard)} className={inputClass}>
              {(Object.keys(BOARD_LABELS) as HotelBoard[]).map((b) => (
                <option key={b} value={b}>{BOARD_LABELS[b]}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={refundable}
              onChange={(e) => setRefundable(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-600"
            />
            Remboursable
          </label>
          <button
            type="button"
            onClick={() => void add()}
            disabled={adding}
            className="flex h-[38px] items-center gap-2 rounded-lg bg-sky-600 px-4 text-[10px] font-black uppercase tracking-wider text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Plan tarifaire
          </button>
        </div>
      </section>
    </div>
  );
}

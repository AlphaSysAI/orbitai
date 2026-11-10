// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { getHotelPlanning, type Planning } from "@/features/hotel/planning/actions";
import { assignRoom } from "@/features/hotel/reservations/actions";
import type { HotelReservationStatus } from "@/types/database.types";

const WINDOW = 14;

const STATUS_BLOCK: Record<HotelReservationStatus, string> = {
  option: "bg-amber-600/80 border-amber-400/50",
  confirmed: "bg-sky-600/80 border-sky-400/50",
  checked_in: "bg-emerald-600/80 border-emerald-400/50",
  checked_out: "bg-slate-600/80 border-slate-400/40",
  no_show: "bg-red-700/70 border-red-500/40",
  cancelled: "bg-slate-800 border-slate-700",
};

const toIso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};
const dayDiff = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);

export function HotelPlanning() {
  const router = useRouter();
  const [start, setStart] = useState(() => toIso(new Date()));
  const [data, setData] = useState<Planning | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const from = start;
  const to = useMemo(() => addDays(start, WINDOW), [start]);
  const days = useMemo(() => Array.from({ length: WINDOW }, (_, i) => addDays(from, i)), [from]);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await getHotelPlanning(from, to);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setError(null);
    setData(result.data);
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const assign = async (reservationRoomId: string, roomId: string) => {
    setAssigning(reservationRoomId);
    setError(null);
    const result = await assignRoom(reservationRoomId, roomId || null);
    setAssigning(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await load();
  };

  const dayLabel = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    const wd = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][d.getUTCDay()];
    return { wd, day: d.getUTCDate() };
  };

  const rooms = data?.rooms ?? [];
  const roomTypes = data?.roomTypes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          <CalendarRange size={26} className="text-sky-400" />
          Planning
        </h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setStart(addDays(start, -7))} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-sky-500/40">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => setStart(toIso(new Date()))} className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-sky-500/40">
            Aujourd&apos;hui
          </button>
          <button type="button" onClick={() => setStart(addDays(start, 7))} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-sky-500/40">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-sky-400" size={32} /></div>
      ) : rooms.length === 0 ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Aucune chambre. Configurez l&apos;inventaire (types + chambres) d&apos;abord.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="min-w-[820px]">
            {/* En-tête dates */}
            <div className="flex border-b border-slate-800 bg-slate-950/50">
              <div className="w-32 shrink-0 border-r border-slate-800 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                Chambre
              </div>
              <div className="flex flex-1">
                {days.map((iso) => {
                  const { wd, day } = dayLabel(iso);
                  const isToday = iso === toIso(new Date());
                  return (
                    <div key={iso} className={`flex-1 border-r border-slate-800/60 py-2 text-center ${isToday ? "bg-sky-500/10" : ""}`}>
                      <div className="text-[9px] uppercase text-slate-500">{wd}</div>
                      <div className={`text-xs font-bold ${isToday ? "text-sky-300" : "text-slate-300"}`}>{day}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lignes par type puis par chambre */}
            {roomTypes.map((rt) => {
              const typeRooms = rooms.filter((r) => r.roomTypeId === rt.id);
              if (typeRooms.length === 0) return null;
              return (
                <div key={rt.id}>
                  <div className="border-b border-slate-800 bg-slate-950/30 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                    {rt.name}
                  </div>
                  {typeRooms.map((room) => {
                    const blocks = (data?.assignments ?? []).filter((a) => a.roomId === room.id);
                    return (
                      <div key={room.id} className="flex border-b border-slate-800/60">
                        <div className="flex w-32 shrink-0 items-center border-r border-slate-800 px-3 py-3 text-sm font-medium text-white">
                          {room.numero}
                        </div>
                        <div className="relative flex-1">
                          {/* fond : cases jours */}
                          <div className="flex h-full">
                            {days.map((iso) => (
                              <div key={iso} className="flex-1 border-r border-slate-800/40" />
                            ))}
                          </div>
                          {/* blocs réservation */}
                          {blocks.map((a) => {
                            const startCol = Math.max(0, dayDiff(from, a.checkIn));
                            const endCol = Math.min(WINDOW, dayDiff(from, a.checkOut));
                            const span = endCol - startCol;
                            if (span <= 0) return null;
                            return (
                              <button
                                key={a.reservationRoomId}
                                type="button"
                                onClick={() => router.push(`/hotel/reservations/${a.reservationId}`)}
                                title={`${a.reference} · ${a.guestName ?? ""}`}
                                className={`absolute top-1.5 bottom-1.5 truncate rounded-md border px-2 text-left text-[11px] font-medium text-white ${STATUS_BLOCK[a.status]}`}
                                style={{ left: `${(startCol / WINDOW) * 100}%`, width: `${(span / WINDOW) * 100}%` }}
                              >
                                {a.guestName || a.reference}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* À placer : réservations sans chambre assignée */}
      {(data?.unassigned.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-6">
          <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-amber-300">
            À placer ({data?.unassigned.length})
          </h3>
          <ul className="space-y-2">
            {data?.unassigned.map((u) => {
              const options = rooms.filter((r) => r.roomTypeId === u.roomTypeId);
              return (
                <li key={u.reservationRoomId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm">
                  <button type="button" onClick={() => router.push(`/hotel/reservations/${u.reservationId}`)} className="text-left">
                    <span className="font-medium text-white">{u.reference}</span>
                    <span className="text-slate-500"> · {u.roomTypeName} · {u.guestName || "—"}</span>
                    <span className="block text-xs text-slate-500">
                      {new Date(u.checkIn).toLocaleDateString("fr-FR")} → {new Date(u.checkOut).toLocaleDateString("fr-FR")}
                    </span>
                  </button>
                  <select
                    defaultValue=""
                    disabled={assigning === u.reservationRoomId}
                    onChange={(e) => void assign(u.reservationRoomId, e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-sky-500"
                  >
                    <option value="">Assigner une chambre…</option>
                    {options.map((r) => (
                      <option key={r.id} value={r.id}>Ch. {r.numero}</option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

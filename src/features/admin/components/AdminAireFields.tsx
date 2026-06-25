// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { Mail, MapPin, Trash2 } from "lucide-react";

import type { AdminClientAireInput, AdminClientAireRecord } from "@/lib/admin/client-aire-schema";
import {
  BISON_FUTE_ZONE_LABELS,
  BISON_FUTE_ZONES,
  type BisonFuteZone,
} from "@/features/regiaire/verdict/bison-fute/schemas";
import {
  AddressAutocomplete,
  type AddressSelection,
} from "@/features/regiaire/aires/components/AddressAutocomplete";

export type AireDraft = AdminClientAireInput & {
  locationConfirmed: boolean;
};

const SCHOOL_ZONES = ["A", "B", "C"] as const;
const WEEKDAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500 placeholder:text-slate-600";

type AdminAireFieldsProps = {
  index: number;
  aire: AireDraft;
  onChange: (aire: AireDraft) => void;
  onRemove?: () => void;
  canRemove?: boolean;
  emailDomain?: string;
  savedRecord?: AdminClientAireRecord;
};

export function AdminAireFields({
  index,
  aire,
  onChange,
  onRemove,
  canRemove = false,
  emailDomain,
  savedRecord,
}: AdminAireFieldsProps) {
  const emailSlug = savedRecord?.emailSlug;
  const emailAddress = emailSlug && emailDomain ? `${emailSlug}@${emailDomain}` : null;
  const toggleOrderDay = (day: number) => {
    onChange({
      ...aire,
      orderDays: aire.orderDays.includes(day)
        ? aire.orderDays.filter((d) => d !== day)
        : [...aire.orderDays, day].sort((a, b) => a - b),
    });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-violet-400">
          <MapPin size={14} />
          Aire {index + 1}
        </p>
        {canRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/10"
          >
            <Trash2 size={12} />
            Retirer
          </button>
        )}
      </div>

      {emailAddress && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-600/5 px-3 py-2.5">
          <Mail size={13} className="shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              Adresse BL par email
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-emerald-200">
              {emailAddress}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(emailAddress)}
            className="shrink-0 rounded-lg border border-emerald-500/30 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10"
          >
            Copier
          </button>
        </div>
      )}

      <label className="block space-y-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Nom de l&apos;aire *
        </span>
        <input
          required
          value={aire.name}
          onChange={(e) => onChange({ ...aire, name: e.target.value })}
          className={inputClass}
          placeholder="Ex. Aire du Lauragais — Carcassonne"
        />
      </label>

      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Adresse *
        </span>
        <AddressAutocomplete
          value={aire.address}
          searchEndpoint="/api/admin/address-search"
          locationConfirmed={aire.locationConfirmed}
          lat={aire.lat}
          lon={aire.lon}
          onChange={(address) =>
            onChange({ ...aire, address, locationConfirmed: false })
          }
          onSelect={(selection: AddressSelection) =>
            onChange({
              ...aire,
              address: selection.label,
              city: selection.city ?? aire.city,
              lat: selection.lat,
              lon: selection.lon,
              locationConfirmed: true,
            })
          }
        />
      </div>

      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Zone Bison Futé
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...aire, bisonFuteZone: null })}
            className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${
              aire.bisonFuteZone == null
                ? "border border-amber-500/40 bg-amber-600/30 text-amber-300"
                : "bg-slate-800 text-slate-500"
            }`}
          >
            —
          </button>
          {BISON_FUTE_ZONES.map((zone) => (
            <button
              key={zone}
              type="button"
              title={BISON_FUTE_ZONE_LABELS[zone]}
              onClick={() => onChange({ ...aire, bisonFuteZone: zone })}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                aire.bisonFuteZone === zone
                  ? "border border-amber-500/40 bg-amber-600/30 text-amber-300"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              {zone}
            </button>
          ))}
        </div>
        {aire.bisonFuteZone != null && (
          <p className="mt-1 text-[10px] text-slate-500">
            {BISON_FUTE_ZONE_LABELS[aire.bisonFuteZone as BisonFuteZone]}
          </p>
        )}
      </div>

      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Zone vacances scolaires
        </span>
        <div className="mt-2 flex gap-2">
          {SCHOOL_ZONES.map((zone) => (
            <button
              key={zone}
              type="button"
              onClick={() => onChange({ ...aire, schoolZone: zone })}
              className={`rounded-lg px-3 py-1 text-xs font-bold uppercase ${
                aire.schoolZone === zone
                  ? "bg-violet-600 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {zone}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Jours de commande
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleOrderDay(day.value)}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${
                aire.orderDays.includes(day.value)
                  ? "border border-violet-500/40 bg-violet-600/30 text-violet-300"
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function aireDraftToPayload(aire: AireDraft): AdminClientAireInput | null {
  if (!aire.locationConfirmed || !aire.name.trim() || aire.address.trim().length < 5) {
    return null;
  }
  const payload: AdminClientAireInput = {
    name: aire.name.trim(),
    address: aire.address.trim(),
    lat: aire.lat,
    lon: aire.lon,
    schoolZone: aire.schoolZone,
    orderDays: aire.orderDays,
    bisonFuteZone: aire.bisonFuteZone ?? null,
  };
  if (aire.city?.trim()) {
    payload.city = aire.city.trim();
  }
  if (aire.id) {
    payload.id = aire.id;
  }
  return payload;
}

export function recordToDraft(
  record: AdminClientAireInput & { id: string }
): AireDraft {
  return {
    ...record,
    address: record.address,
    city: record.city ?? "",
    locationConfirmed: true,
  };
}

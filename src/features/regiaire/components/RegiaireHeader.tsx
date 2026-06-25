// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Loader2,
  MapPin,
  Sun,
} from "lucide-react";

import { SaasBrandTitle } from "@/components/branding/SaasBrandTitle";
import { getRegiaireHeaderInfo } from "@/features/regiaire/actions/get-header-info";
import type { RegiaireHeaderSnapshot } from "@/features/regiaire/lib/header-snapshot";
import { useOrganizationModules } from "@/hooks/useOrganizationModules";
import { resolveSaasBrandFromModules } from "@/lib/organizations/saas-branding";

const REFRESH_MS = 15 * 60 * 1000;

function WeatherIcon({ code }: { code: number }) {
  const className = "text-amber-400 shrink-0";
  const size = 18;

  if (code <= 1) return <Sun size={size} className={className} />;
  if (code <= 3) return <CloudSun size={size} className={className} />;
  if (code === 45 || code === 48) return <CloudFog size={size} className={className} />;
  if (code === 95) return <CloudLightning size={size} className={className} />;
  if ([51, 61, 63, 80].includes(code)) {
    return <CloudRain size={size} className={className} />;
  }
  return <Cloud size={size} className={className} />;
}

type RegiaireHeaderProps = {
  aireId: string;
  initial?: RegiaireHeaderSnapshot | null;
};

export function RegiaireHeader({ aireId, initial = null }: RegiaireHeaderProps) {
  const { enabledModules } = useOrganizationModules();
  const brand = resolveSaasBrandFromModules(enabledModules);
  const [snapshot, setSnapshot] = useState<RegiaireHeaderSnapshot | null>(initial);
  const [isRefreshing, setIsRefreshing] = useState(!initial);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    const result = await getRegiaireHeaderInfo(aireId);
    if (result.success) {
      setSnapshot(result.data);
    }
    setIsRefreshing(false);
  }, [aireId]);

  useEffect(() => {
    if (!initial) {
      void refresh();
    }
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [initial, refresh, aireId]);

  const stationName = snapshot?.stationName;
  const weather = snapshot?.weather;

  return (
    <header className="z-20 flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-6 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 w-6 rounded-full bg-amber-500" />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">
          <SaasBrandTitle brand={brand} size="sm" />
        </span>
      </div>

      {/* Station + weather */}
      <div className="flex items-center gap-4">
        {stationName ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5">
            <MapPin size={12} className="shrink-0 text-amber-500" />
            <span className="max-w-[200px] truncate text-[11px] font-bold uppercase tracking-wider text-slate-200">
              {stationName}
            </span>
          </div>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
            Aire non configurée
          </span>
        )}

        {isRefreshing && !weather ? (
          <Loader2 size={14} className="animate-spin text-slate-600" />
        ) : weather?.available ? (
          <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 sm:flex">
            <WeatherIcon code={weather.weatherCode} />
            <span className="text-[11px] font-bold tabular-nums text-slate-200">
              {Math.round(weather.tempMinC)}–{Math.round(weather.tempMaxC)}°C
            </span>
            <span className="hidden capitalize text-[10px] text-slate-500 lg:inline">
              · {weather.label}
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
}

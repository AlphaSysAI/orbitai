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
    <header className="z-20 flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-800 bg-[#0f172a]/50 px-8 backdrop-blur-md">
      <div className="flex items-center gap-8 text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">
        <span className="border-b-2 border-amber-500 py-5 text-amber-400">
          <SaasBrandTitle brand={brand} size="sm" />
        </span>
      </div>

      <div className="flex items-center gap-6">
        {stationName ? (
          <span className="flex max-w-[280px] items-center gap-2 truncate text-[10px] font-bold uppercase tracking-wider text-slate-300">
            <MapPin size={14} className="shrink-0 text-amber-500" />
            <span className="truncate">{stationName}</span>
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Aire non configurée
          </span>
        )}

        {isRefreshing && !weather ? (
          <Loader2 size={16} className="animate-spin text-slate-500" />
        ) : weather?.available ? (
          <span className="flex items-center gap-2 text-[11px] font-medium text-slate-200">
            <WeatherIcon code={weather.weatherCode} />
            <span>
              {Math.round(weather.tempMinC)}–{Math.round(weather.tempMaxC)}°C
            </span>
            <span className="hidden text-slate-500 sm:inline">·</span>
            <span className="hidden capitalize text-slate-400 sm:inline">
              {weather.label}
            </span>
          </span>
        ) : (
          <span className="text-[10px] text-slate-600">
            {weather?.reason ?? "Météo…"}
          </span>
        )}
      </div>
    </header>
  );
}

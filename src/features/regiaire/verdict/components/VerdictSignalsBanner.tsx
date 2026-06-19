import {
  CalendarCheck,
  CloudOff,
  Palmtree,
  TrafficCone,
} from "lucide-react";

import { weatherDayLabel } from "@/features/regiaire/verdict/lib/weather-labels";
import {
  weatherIconForCode,
} from "@/features/regiaire/verdict/lib/verdict-display";
import type { VerdictSignalsSnapshot } from "@/features/regiaire/verdict/schemas";

type VerdictSignalsBannerProps = {
  signals: VerdictSignalsSnapshot;
};

export function VerdictSignalsBanner({ signals }: VerdictSignalsBannerProps) {
  const { weather, schoolHoliday, traffic } = signals;

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <SignalCard title="Météo" icon={<CloudOff size={14} className="text-sky-400" />}>
        {weather.available && weather.forecast ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weather.forecast.days.map((day) => {
              const Icon = weatherIconForCode(day.weatherCode);
              const isToday = day.date === signals.runDate;
              return (
                <div
                  key={day.date}
                  className={`flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-center ${
                    isToday
                      ? "border-sky-500/40 bg-sky-600/10"
                      : "border-slate-700/60 bg-slate-950/50"
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase text-slate-500">
                    {isToday
                      ? "J0"
                      : `J+${Math.round(
                          (Date.parse(`${day.date}T12:00:00Z`) -
                            Date.parse(`${signals.runDate}T12:00:00Z`)) /
                            86_400_000
                        )}`}
                  </span>
                  <Icon size={18} className="my-1 text-sky-300" />
                  <span className="text-xs font-bold text-white">
                    {Math.round(day.tempMaxC)}°
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[8px] leading-tight text-slate-500">
                    {weatherDayLabel(day.weatherCode)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <UnavailableHint />
        )}
      </SignalCard>

      <SignalCard title="Vacances" icon={<Palmtree size={14} className="text-violet-400" />}>
        {schoolHoliday.available && schoolHoliday.status ? (
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">
              Zone {schoolHoliday.status.schoolZone}
            </p>
            <p
              className={`text-xs font-semibold ${
                schoolHoliday.status.isOnHoliday
                  ? "text-violet-300"
                  : "text-slate-400"
              }`}
            >
              {schoolHoliday.status.isOnHoliday
                ? "En vacances scolaires"
                : "Hors vacances scolaires"}
            </p>
            {schoolHoliday.status.label && (
              <p className="text-[11px] text-slate-500">
                {schoolHoliday.status.label}
              </p>
            )}
          </div>
        ) : (
          <UnavailableHint />
        )}
      </SignalCard>

      <SignalCard title="Trafic" icon={<TrafficCone size={14} className="text-orange-400" />}>
        {traffic.available && traffic.footfallIndex != null ? (
          <div>
            <p className="text-2xl font-black tabular-nums text-white">
              {traffic.footfallIndex.toFixed(0)}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Indice fréquentation · {traffic.signalDate}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {traffic.footfallIndex >= 110
                ? "Trafic au-dessus de la normale"
                : traffic.footfallIndex <= 90
                  ? "Trafic en dessous de la normale"
                  : "Trafic dans la normale"}
            </p>
          </div>
        ) : (
          <UnavailableHint />
        )}
      </SignalCard>
    </section>
  );
}

function SignalCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function UnavailableHint() {
  return (
    <p className="text-xs text-slate-600">Indisponible</p>
  );
}

export function OrderDayBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-600/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
      <CalendarCheck size={12} />
      Jour de commande
    </span>
  );
}

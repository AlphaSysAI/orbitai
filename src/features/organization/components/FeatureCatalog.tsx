// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useState } from "react";
import {
  PackageCheck,
  Users,
  Sparkles,
  TrendingUp,
  CalendarCheck,
  BadgeEuro,
  ReceiptText,
  PhoneCall,
  MessagesSquare,
  Workflow,
  GitBranch,
  HeartHandshake,
  Check,
  Loader2,
  Lock,
  type LucideIcon,
} from "lucide-react";

import {
  FEATURE_GROUPS,
  featuresByGroup,
  type FeatureDef,
  type FeatureGroup,
} from "@/lib/organizations/feature-catalog";
import { setOrgFeatureEnabled } from "@/features/organization/actions/features";

const ICONS: Record<string, LucideIcon> = {
  PackageCheck,
  Users,
  Sparkles,
  TrendingUp,
  CalendarCheck,
  BadgeEuro,
  ReceiptText,
  PhoneCall,
  MessagesSquare,
  Workflow,
  GitBranch,
  HeartHandshake,
};

const GROUP_ORDER: FeatureGroup[] = ["aire", "hotel", "addon"];

export function FeatureCatalog({
  initialEnabled,
  isOrgAdmin,
}: {
  initialEnabled: string[];
  isOrgAdmin: boolean;
}) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(initialEnabled));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (feature: FeatureDef) => {
    setBusyId(feature.id);
    setError(null);
    const next = !enabled.has(feature.id);
    const result = await setOrgFeatureEnabled(feature.id, next);
    setBusyId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEnabled(new Set(result.enabledFeatureIds));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-black uppercase tracking-tight text-white">
          Catalogue des features
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Activez uniquement les briques dont vous avez besoin. Facturation
          mensuelle, sans engagement, modifiable à tout moment.
        </p>
      </header>

      {error && (
        <p className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {!isOrgAdmin && (
        <p className="mb-6 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-300">
          <Lock size={15} />
          Seul un administrateur de votre organisation peut gérer les abonnements.
        </p>
      )}

      <div className="space-y-10">
        {GROUP_ORDER.map((group) => {
          const features = featuresByGroup(group);
          if (features.length === 0) return null;
          return (
            <section key={group}>
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">
                  {FEATURE_GROUPS[group].label}
                </h2>
                <span className="text-xs text-slate-500">
                  {FEATURE_GROUPS[group].brand}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {features.map((feature) => {
                  const Icon = ICONS[feature.icon] ?? Sparkles;
                  const isOn = enabled.has(feature.id);
                  const busy = busyId === feature.id;
                  return (
                    <article
                      key={feature.id}
                      className={`relative flex flex-col rounded-2xl border p-5 transition-colors ${
                        isOn
                          ? "border-emerald-500/40 bg-emerald-500/[0.04]"
                          : "border-slate-800 bg-slate-900/40"
                      }`}
                    >
                      {isOn && (
                        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          <Check size={11} /> Actif
                        </span>
                      )}

                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800">
                          <Icon size={20} className={feature.accent} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white">{feature.label}</h3>
                          <p className="text-xs text-slate-500">{feature.tagline}</p>
                        </div>
                      </div>

                      <p className="mb-3 text-sm text-slate-400">
                        {feature.description}
                      </p>

                      <ul className="mb-4 space-y-1">
                        {feature.highlights.map((h) => (
                          <li
                            key={h}
                            className="flex items-center gap-2 text-xs text-slate-400"
                          >
                            <Check size={12} className="text-slate-600" />
                            {h}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                        <span className="text-sm text-slate-300">
                          <span className="text-lg font-black text-white">
                            {feature.priceEurMonthly} €
                          </span>
                          <span className="text-xs text-slate-500"> /mois</span>
                        </span>
                        <button
                          type="button"
                          disabled={!isOrgAdmin || busy}
                          onClick={() => void toggle(feature)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-colors disabled:opacity-50 ${
                            isOn
                              ? "border border-slate-700 text-slate-300 hover:bg-slate-800"
                              : "bg-violet-600 text-white hover:bg-violet-500"
                          }`}
                        >
                          {busy ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : isOn ? (
                            "Se désabonner"
                          ) : (
                            "S'abonner"
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Copyright © 2026 OrbitSys. Tous droits réservés.

import Link from "next/link";
import {
  ArrowRight,
  BadgeEuro,
  CalendarCheck,
  Check,
  GitBranch,
  HeartHandshake,
  MessagesSquare,
  Orbit,
  PackageCheck,
  PhoneCall,
  ReceiptText,
  Rocket,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import {
  FEATURE_GROUPS,
  featuresByGroup,
  type FeatureGroup,
} from "@/lib/organizations/feature-catalog";

export const metadata = {
  title: "OrbitAll — La plateforme métier modulaire, à la carte",
  description:
    "OrbitAll réunit vos applications métier (stations-service, hôtellerie) et des add-ons IA transverses. Activez uniquement les briques dont vous avez besoin, sans engagement.",
};

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

const GROUP_RING: Record<FeatureGroup, string> = {
  aire: "hover:border-amber-500/40",
  hotel: "hover:border-sky-500/40",
  addon: "hover:border-teal-500/40",
};

const GROUP_DOT: Record<FeatureGroup, string> = {
  aire: "bg-amber-400",
  hotel: "bg-sky-400",
  addon: "bg-teal-400",
};

const STEPS = [
  {
    Icon: Rocket,
    title: "Créez votre espace",
    text: "Inscription en une minute. Votre organisation est prête immédiatement, sans installation.",
  },
  {
    Icon: SlidersHorizontal,
    title: "Activez vos features",
    text: "Piochez uniquement les briques utiles dans le catalogue. Chaque feature s'active indépendamment.",
  },
  {
    Icon: TrendingUp,
    title: "Pilotez au quotidien",
    text: "Vos équipes travaillent dans une interface unique, augmentée par l'IA. Ajustez votre abonnement quand vous voulez.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* ─── Barre de navigation ─── */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#020617]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-violet-600 p-1.5">
              <Orbit size={18} className="text-white" />
            </span>
            <span className="text-sm font-black uppercase italic tracking-tighter">
              OrbitAll
            </span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-300 hover:text-white"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-violet-600 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white hover:bg-violet-500"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-[-10rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
            <Sparkles size={13} /> Plateforme métier modulaire
          </span>
          <h1 className="mt-6 text-4xl font-black uppercase italic leading-[1.05] tracking-tighter sm:text-6xl">
            Vos métiers.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-sky-400 to-amber-300 bg-clip-text text-transparent">
              Une seule plateforme.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-slate-400 sm:text-lg">
            OrbitAll réunit vos applications métier et des add-ons IA transverses.
            Activez uniquement les briques dont vous avez besoin — facturation
            mensuelle, sans engagement, modifiable à tout moment.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-7 py-3.5 text-[12px] font-black uppercase tracking-wider text-white hover:bg-violet-500 sm:w-auto"
            >
              Démarrer gratuitement
              <ArrowRight size={16} />
            </Link>
            <Link
              href="#features"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-7 py-3.5 text-[12px] font-black uppercase tracking-wider text-slate-200 hover:border-slate-500 sm:w-auto"
            >
              Voir les features
            </Link>
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-emerald-400" />
            Sans carte bancaire pour commencer · Sans engagement
          </p>
        </div>
      </section>

      {/* ─── Comment ça marche ─── */}
      <section className="border-y border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-black uppercase tracking-tight sm:text-3xl">
            Démarrer en 3 étapes
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {STEPS.map(({ Icon, title, text }, i) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/15 text-violet-300">
                    <Icon size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                    Étape {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-black uppercase tracking-tight">{title}</h3>
                <p className="mt-2 text-sm text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features par univers ─── */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
            Un catalogue de briques métier
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
            Chaque feature est vendue séparément. Composez l&apos;offre exacte de
            votre entreprise, et faites-la évoluer quand vos besoins changent.
          </p>
        </div>

        <div className="mt-14 space-y-16">
          {GROUP_ORDER.map((group) => {
            const features = featuresByGroup(group);
            if (features.length === 0) return null;
            return (
              <div key={group}>
                <div className="mb-6 flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${GROUP_DOT[group]}`} />
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">
                    {FEATURE_GROUPS[group].label}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {FEATURE_GROUPS[group].brand}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {features.map((feature) => {
                    const Icon = ICONS[feature.icon] ?? Sparkles;
                    return (
                      <article
                        key={feature.id}
                        className={`flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-6 transition-colors ${GROUP_RING[group]}`}
                      >
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800">
                            <Icon size={22} className={feature.accent} />
                          </div>
                          <div>
                            <h4 className="font-bold leading-tight text-white">
                              {feature.label}
                            </h4>
                            <p className="text-xs text-slate-500">{feature.tagline}</p>
                          </div>
                        </div>
                        <p className="mb-4 text-sm text-slate-400">{feature.description}</p>
                        <ul className="mb-5 space-y-1.5">
                          {feature.highlights.map((h) => (
                            <li key={h} className="flex items-start gap-2 text-xs text-slate-400">
                              <Check size={13} className="mt-0.5 shrink-0 text-emerald-400" />
                              {h}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-auto flex items-baseline gap-1 border-t border-slate-800 pt-4">
                          <span className="text-2xl font-black text-white">
                            {feature.priceEurMonthly} €
                          </span>
                          <span className="text-xs text-slate-500">/ mois · par organisation</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Argument tarifaire ─── */}
      <section className="border-y border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                Icon: SlidersHorizontal,
                title: "À la carte",
                text: "Payez uniquement les features activées. Rien de superflu.",
              },
              {
                Icon: BadgeEuro,
                title: "Un seul abonnement",
                text: "Toutes vos briques réunies sur une facture mensuelle claire.",
              },
              {
                Icon: ShieldCheck,
                title: "Sans engagement",
                text: "Activez, désactivez et ajustez à tout moment, en autonomie.",
              },
            ].map(({ Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/15 text-violet-300">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">{title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA final ─── */}
      <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">
          Prêt à composer votre OrbitAll ?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm text-slate-400">
          Créez votre espace, choisissez vos features et invitez vos équipes.
          Vous gardez la main sur votre abonnement.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-8 py-4 text-[12px] font-black uppercase tracking-wider text-white hover:bg-violet-500"
        >
          Créer mon compte
          <ArrowRight size={16} />
        </Link>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-800/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-violet-600/80 p-1">
              <Orbit size={14} className="text-white" />
            </span>
            <span className="font-black uppercase italic tracking-tighter text-slate-300">
              OrbitAll
            </span>
            <span className="text-slate-600">· édité par AlphaSys / OrbitSys</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-slate-300">
              Se connecter
            </Link>
            <Link href="/signup" className="hover:text-slate-300">
              Créer un compte
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Loader2,
  Play,
  Settings,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { type FeedbackItem, type MarketingAnalysis } from "../hooks/useClientSynthesis";

interface ClientDashboardProps {
  feedbackItems: FeedbackItem[];
  analyses: MarketingAnalysis[];
  activeAnalysis: MarketingAnalysis | null;
  isLoading: boolean;
  onRunAnalysis: (periodStart?: string, periodEnd?: string, sourceIds?: string[]) => Promise<unknown>;
  onLoadAnalysis: (id: string) => void;
  onDeleteAnalysis?: (id: string) => Promise<void>;
  onDeleteAllAnalyses?: () => Promise<void>;
  // Review sync props
  reviewSyncConnected: boolean;
  placeName: string | null;
  lastSyncAt: string | null;
  newReviewsCount: number;
  totalReviewsSynced: number;
  onDismissNotifications: () => Promise<void>;
}

export function ClientDashboard({
  feedbackItems,
  analyses,
  activeAnalysis,
  isLoading,
  onRunAnalysis,
  onLoadAnalysis,
  onDeleteAnalysis,
  onDeleteAllAnalyses,
  reviewSyncConnected,
  placeName,
  lastSyncAt,
  newReviewsCount,
  totalReviewsSynced,
  onDismissNotifications,
}: ClientDashboardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const totalFeedback = feedbackItems.length;
  const positiveCount = feedbackItems.filter((f) => f.sentiment === "positive").length;
  const negativeCount = feedbackItems.filter((f) => f.sentiment === "negative").length;
  const sentimentScore =
    totalFeedback > 0 ? ((positiveCount - negativeCount) / totalFeedback) * 100 : 0;

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      await onRunAnalysis();
      if (newReviewsCount > 0) await onDismissNotifications();
      setShowFullAnalysis(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erreur inconnue";
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDismiss = async () => {
    setIsDismissing(true);
    await onDismissNotifications();
    setIsDismissing(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* ── Notification nouveaux avis ── */}
      {newReviewsCount > 0 && (
        <div className="relative flex items-start gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/8 px-6 py-5">
          <Bell size={20} className="mt-0.5 flex-none text-amber-400" />
          <div className="flex-1">
            <p className="font-semibold text-amber-300 text-sm">
              {newReviewsCount} nouvel{newReviewsCount > 1 ? "s" : ""} avis depuis votre dernière analyse
            </p>
            <p className="mt-0.5 text-xs text-amber-400/70">
              Relancez l'analyse pour les intégrer.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <button
              onClick={() => void handleRunAnalysis()}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black hover:bg-amber-400 disabled:opacity-50"
            >
              {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Analyser
            </button>
            <button
              onClick={() => void handleDismiss()}
              disabled={isDismissing}
              className="rounded-xl p-2 text-amber-400/60 hover:text-amber-300 disabled:opacity-40"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold uppercase italic tracking-tighter text-white">
            Synthèse Client
          </h1>
          {reviewSyncConnected ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
              <Star size={13} className="text-yellow-400" />
              {placeName ?? "Google Reviews"}
              {lastSyncAt && (
                <span className="text-slate-600">
                  · synchro {new Date(lastSyncAt).toLocaleDateString("fr-FR")}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Connectez vos avis Google dans{" "}
              <span className="text-violet-400">Réglages → Avis Google</span> pour démarrer.
            </p>
          )}
        </div>
        <button
          onClick={() => void handleRunAnalysis()}
          disabled={isAnalyzing || totalFeedback === 0}
          className="inline-flex flex-none items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {isAnalyzing ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {isAnalyzing ? "Analyse en cours…" : "Lancer l'analyse IA"}
        </button>
      </div>

      {analysisError && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {analysisError}
        </p>
      )}

      {/* ── Cartes stats ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Avis collectés"
          value={totalReviewsSynced > 0 ? totalReviewsSynced.toLocaleString("fr-FR") : totalFeedback.toString()}
          sub={totalReviewsSynced > 0 ? `${totalFeedback} analysés` : "toutes sources"}
          icon={<Star size={18} className="text-yellow-400" />}
        />
        <StatCard
          label="Sentiment"
          value={`${sentimentScore > 0 ? "+" : ""}${sentimentScore.toFixed(0)}%`}
          sub={`${positiveCount} positifs / ${negativeCount} négatifs`}
          icon={
            sentimentScore >= 0
              ? <TrendingUp size={18} className="text-emerald-400" />
              : <TrendingDown size={18} className="text-red-400" />
          }
        />
        <StatCard
          label="Analyses réalisées"
          value={analyses.length.toString()}
          sub={analyses[0] ? `Dernière : ${new Date(analyses[0].created_at).toLocaleDateString("fr-FR")}` : "—"}
          icon={<BarChart2 size={18} className="text-blue-400" />}
        />
        <StatCard
          label="Nouveaux avis"
          value={newReviewsCount > 0 ? newReviewsCount.toString() : "—"}
          sub="depuis la dernière analyse"
          icon={<Bell size={18} className={newReviewsCount > 0 ? "text-amber-400" : "text-slate-600"} />}
          highlight={newReviewsCount > 0}
        />
      </div>

      {/* ── Pas encore connecté ── */}
      {!reviewSyncConnected && totalFeedback === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <Settings size={40} className="mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-bold text-white mb-2">Aucune donnée</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Connectez vos avis Google dans <strong className="text-violet-300">Réglages → Avis Google</strong>.
            L'import initial se lance automatiquement lors de la connexion.
          </p>
        </div>
      )}

      {/* ── Dernière analyse ── */}
      {activeAnalysis && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h2 className="font-bold text-white">Dernière analyse</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date(activeAnalysis.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric", month: "long", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })} · {activeAnalysis.total_feedback_analyzed} avis
              </p>
            </div>
            <button
              onClick={() => setShowFullAnalysis((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-white hover:border-slate-600"
            >
              {showFullAnalysis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showFullAnalysis ? "Réduire" : "Voir tout"}
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Métriques */}
            <div className="grid grid-cols-3 gap-4">
              <Metric label="Sentiment" value={`${activeAnalysis.overall_sentiment > 0 ? "+" : ""}${(activeAnalysis.overall_sentiment * 100).toFixed(0)}%`} />
              <Metric label="Satisfaction" value={`${(activeAnalysis.satisfaction_score * 100).toFixed(0)}%`} />
              <Metric label="NPS estimé" value={`${activeAnalysis.nps_score > 0 ? "+" : ""}${activeAnalysis.nps_score.toFixed(0)}`} />
            </div>

            {/* Faiblesses + Leviers */}
            <div className="grid gap-4 md:grid-cols-2">
              <AnalysisSection
                title="Faiblesses"
                count={activeAnalysis.weaknesses?.length ?? 0}
                icon={<AlertTriangle size={14} />}
                color="red"
              >
                {(showFullAnalysis ? activeAnalysis.weaknesses : activeAnalysis.weaknesses?.slice(0, 3))?.map((w, i) => (
                  <div key={i} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-xs font-semibold text-white">{w.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2">{w.description}</p>
                    <p className="mt-1 text-[10px] text-red-400">Gravité : {w.severity} · {w.frequency} mentions</p>
                  </div>
                ))}
              </AnalysisSection>

              <AnalysisSection
                title="Leviers"
                count={activeAnalysis.levers?.length ?? 0}
                icon={<Lightbulb size={14} />}
                color="emerald"
              >
                {(showFullAnalysis ? activeAnalysis.levers : activeAnalysis.levers?.slice(0, 3))?.map((l, i) => (
                  <div key={i} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-xs font-semibold text-white">{l.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2">{l.description}</p>
                    <p className="mt-1 text-[10px] text-emerald-400">Priorité : {l.priority} · {l.type}</p>
                  </div>
                ))}
              </AnalysisSection>
            </div>

            {/* Recommandations (si vue complète) */}
            {showFullAnalysis && activeAnalysis.recommendations?.length > 0 && (
              <div>
                <h3 className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Recommandations ({activeAnalysis.recommendations.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeAnalysis.recommendations.map((r, i) => (
                    <div key={i} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                      <p className="text-xs font-semibold text-white">{r.recommendation}</p>
                      <p className="mt-1 text-[10px] text-blue-400">Priorité : {r.priority}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Insights clés (si vue complète) */}
            {showFullAnalysis && activeAnalysis.key_insights?.length > 0 && (
              <div>
                <h3 className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Insights clés ({activeAnalysis.key_insights.length})
                </h3>
                <div className="space-y-2">
                  {activeAnalysis.key_insights.map((ins, i) => (
                    <div key={i} className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                      <p className="text-xs text-white">{ins.insight}</p>
                      {ins.supporting_evidence && (
                        <p className="mt-1 text-[10px] text-slate-500">{ins.supporting_evidence}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Historique des analyses ── */}
      {analyses.length > 1 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Historique ({analyses.length})</h2>
            {onDeleteAllAnalyses && (
              <button
                onClick={async () => {
                  if (confirm("Supprimer toutes les analyses ?")) {
                    await onDeleteAllAnalyses();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-800/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-400 hover:border-red-600/50"
              >
                <Trash2 size={12} />
                Tout supprimer
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {analyses.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 rounded-xl px-4 py-3 hover:bg-slate-800/50 transition group cursor-pointer"
                onClick={() => onLoadAnalysis(a.id)}
              >
                <div>
                  <p className="text-sm text-white">
                    {new Date(a.created_at).toLocaleDateString("fr-FR", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {a.total_feedback_analyzed} avis · {a.weaknesses?.length ?? 0} faiblesses · {a.levers?.length ?? 0} leviers
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                  <span className="text-xs text-emerald-400">Voir →</span>
                  {onDeleteAnalysis && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm("Supprimer cette analyse ?")) {
                          setDeletingId(a.id);
                          await onDeleteAnalysis(a.id);
                          setDeletingId(null);
                        }
                      }}
                      disabled={deletingId === a.id}
                      className="p-1 text-red-400 hover:text-red-300 rounded disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, highlight,
}: {
  label: string; value: string; sub: string; icon: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? "border-amber-500/30 bg-amber-500/5" : "border-slate-800 bg-slate-900/40"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-extrabold text-white">{value}</div>
      <div className="mt-0.5 text-[10px] text-slate-500 truncate">{sub}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function AnalysisSection({
  title, count, icon, color, children,
}: {
  title: string; count: number; icon: React.ReactNode; color: "red" | "emerald"; children: React.ReactNode;
}) {
  const colorMap = {
    red: "text-red-400",
    emerald: "text-emerald-400",
  };
  return (
    <div>
      <h3 className={`mb-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${colorMap[color]}`}>
        {icon}
        {title} ({count})
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

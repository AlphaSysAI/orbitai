// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { ArrowLeft, AlertTriangle, Lightbulb, TrendingUp, Target, AlertCircle } from "lucide-react";
import type { MarketingAnalysis } from "../hooks/useClientSynthesis";

interface AnalysisViewProps {
  analysis: MarketingAnalysis;
  onBack: () => void;
}

export function AnalysisView({ analysis, onBack }: AnalysisViewProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/30';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
          >
            <ArrowLeft className="text-slate-400" size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Analyse Marketing & Communication</h1>
            <p className="text-slate-400">
              {new Date(analysis.created_at).toLocaleDateString('fr-FR', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Métriques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">Sentiment global</div>
          <div className="text-2xl font-bold text-white">
            {analysis.overall_sentiment > 0 ? '+' : ''}
            {(analysis.overall_sentiment * 100).toFixed(0)}%
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">Satisfaction</div>
          <div className="text-2xl font-bold text-white">
            {(analysis.satisfaction_score * 100).toFixed(0)}%
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">NPS estimé</div>
          <div className="text-2xl font-bold text-white">
            {analysis.nps_score > 0 ? '+' : ''}{analysis.nps_score.toFixed(0)}
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">Retours analysés</div>
          <div className="text-2xl font-bold text-white">{analysis.total_feedback_analyzed}</div>
        </div>
      </div>

      {/* Faiblesses */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="text-red-400" size={24} />
          Faiblesses identifiées
        </h2>
        <div className="space-y-4">
          {(analysis.weaknesses || []).map((weakness, idx) => (
            <div key={idx} className={`bg-slate-900/50 border rounded-xl p-6 ${getSeverityColor(weakness.severity)}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">{weakness.title}</h3>
                  <p className="text-slate-300 mb-4">{weakness.description}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${getSeverityColor(weakness.severity)}`}>
                  {weakness.severity}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Impact</div>
                  <div className="text-sm text-white">{weakness.impact}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-1">Catégorie</div>
                  <div className="text-sm text-white capitalize">{weakness.category}</div>
                </div>
              </div>
              {weakness.examples && weakness.examples.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">Exemples ({weakness.frequency} mentions) :</div>
                  <ul className="space-y-1">
                    {weakness.examples.slice(0, 3).map((example, eIdx) => (
                      <li key={eIdx} className="text-sm text-slate-300 italic">• {example}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Leviers */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Lightbulb className="text-emerald-400" size={24} />
          Leviers Marketing & Communication
        </h2>
        <div className="space-y-4">
          {(analysis.levers || []).map((lever, idx) => (
            <div key={idx} className={`bg-slate-900/50 border rounded-xl p-6 ${getPriorityColor(lever.priority)}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">{lever.title}</h3>
                  <p className="text-slate-300 mb-4">{lever.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${getPriorityColor(lever.priority)}`}>
                    {lever.priority}
                  </span>
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-400 capitalize">
                    {lever.type}
                  </span>
                </div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-slate-400 mb-1">Impact attendu</div>
                <div className="text-sm text-white">{lever.expected_impact}</div>
              </div>
              {lever.actions && lever.actions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">Actions recommandées :</div>
                  <ul className="space-y-2">
                    {lever.actions.map((action, aIdx) => (
                      <li key={aIdx} className="flex items-start gap-2 text-sm text-slate-300">
                        <Target className="text-emerald-400 flex-shrink-0 mt-0.5" size={16} />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lever.resources_needed && lever.resources_needed.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div className="text-xs text-slate-400 mb-2">Ressources nécessaires :</div>
                  <div className="flex flex-wrap gap-2">
                    {lever.resources_needed.map((resource, rIdx) => (
                      <span key={rIdx} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-400">
                        {resource}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Opportunités et Menaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="text-blue-400" size={20} />
            Opportunités
          </h2>
          <div className="space-y-3">
            {(analysis.opportunities || []).map((opp, idx) => (
              <div key={idx} className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <h3 className="font-bold text-white mb-2">{opp.title}</h3>
                <p className="text-sm text-slate-300 mb-3">{opp.description}</p>
                <div className="text-xs text-blue-400 mb-2">Valeur potentielle: {opp.potential_value}</div>
                {opp.recommended_actions && opp.recommended_actions.length > 0 && (
                  <ul className="space-y-1">
                    {opp.recommended_actions.slice(0, 2).map((action, aIdx) => (
                      <li key={aIdx} className="text-xs text-slate-400">• {action}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="text-orange-400" size={20} />
            Menaces
          </h2>
          <div className="space-y-3">
            {(analysis.threats || []).map((threat, idx) => (
              <div key={idx} className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-white">{threat.title}</h3>
                  <span className="text-xs text-orange-400 capitalize">{threat.urgency}</span>
                </div>
                <p className="text-sm text-slate-300">{threat.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recommandations et Insights */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-4">Recommandations prioritaires</h2>
        <div className="space-y-3">
          {(analysis.recommendations || []).map((rec, idx) => (
            <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className={`px-2 py-1 rounded text-xs font-bold ${getPriorityColor(rec.priority)}`}>
                  {rec.priority}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium mb-1">{rec.recommendation}</div>
                  <div className="text-sm text-slate-400">{rec.expected_outcome}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}





"use client";

import { TrendingUp, TrendingDown, Activity, AlertCircle, Target } from "lucide-react";
import { Scenario } from "../types";

interface ScenarioCardProps {
  scenario: Scenario;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onCompare?: boolean;
}

export function ScenarioCard({ scenario, isSelected, onSelect, onCompare }: ScenarioCardProps) {
  const getIcon = () => {
    switch (scenario.type) {
      case 'optimistic':
      case 'best-case':
        return <TrendingUp className="text-green-400" size={20} />;
      case 'pessimistic':
      case 'worst-case':
        return <TrendingDown className="text-red-400" size={20} />;
      default:
        return <Activity className="text-sky-400" size={20} />;
    }
  };

  const getColor = () => {
    switch (scenario.type) {
      case 'optimistic':
      case 'best-case':
        return 'border-green-500/30 bg-green-500/5';
      case 'pessimistic':
      case 'worst-case':
        return 'border-red-500/30 bg-red-500/5';
      default:
        return 'border-sky-500/30 bg-sky-500/5';
    }
  };

  return (
    <div
      className={`rounded-2xl border p-6 cursor-pointer transition-all hover:border-sky-500/50 ${
        isSelected ? 'border-sky-500 ring-2 ring-sky-500/20' : getColor()
      }`}
      onClick={() => onSelect?.(scenario.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {getIcon()}
          <div>
            <h3 className="font-bold text-white">{scenario.title}</h3>
            {scenario.probability && (
              <p className="text-xs text-slate-400 mt-1">
                Probabilité: {scenario.probability}%
              </p>
            )}
          </div>
        </div>
        {onCompare && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect?.(scenario.id)}
            className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-sky-600 focus:ring-sky-500"
          />
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-slate-300 mb-4 leading-relaxed">{scenario.description}</p>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-slate-900/50 rounded-lg">
        {scenario.metrics.roi !== undefined && (
          <div>
            <p className="text-xs text-slate-400">ROI</p>
            <p className="text-sm font-bold text-white">{scenario.metrics.roi > 0 ? '+' : ''}{scenario.metrics.roi}%</p>
          </div>
        )}
        {scenario.metrics.cost !== undefined && (
          <div>
            <p className="text-xs text-slate-400">Coût</p>
            <p className="text-sm font-bold text-white">{scenario.metrics.cost.toLocaleString()}€</p>
          </div>
        )}
        {scenario.metrics.duration !== undefined && (
          <div>
            <p className="text-xs text-slate-400">Durée</p>
            <p className="text-sm font-bold text-white">{scenario.metrics.duration} mois</p>
          </div>
        )}
        {scenario.metrics.risk !== undefined && (
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-orange-400" />
            <div>
              <p className="text-xs text-slate-400">Risque</p>
              <p className="text-sm font-bold text-white">{scenario.metrics.risk}/10</p>
            </div>
          </div>
        )}
        {scenario.metrics.impact !== undefined && (
          <div className="flex items-center gap-2">
            <Target size={14} className="text-blue-400" />
            <div>
              <p className="text-xs text-slate-400">Impact</p>
              <p className="text-sm font-bold text-white">{scenario.metrics.impact}/10</p>
            </div>
          </div>
        )}
      </div>

      {/* SWOT */}
      {scenario.swot && (
        <div className="mb-4 p-3 bg-slate-900/30 rounded-lg">
          <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Analyse SWOT</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-green-400 font-semibold mb-1">Forces</p>
              <ul className="text-slate-300 space-y-1">
                {scenario.swot.strengths.slice(0, 2).map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-orange-400 font-semibold mb-1">Faiblesses</p>
              <ul className="text-slate-300 space-y-1">
                {scenario.swot.weaknesses.slice(0, 2).map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-blue-400 font-semibold mb-1">Opportunités</p>
              <ul className="text-slate-300 space-y-1">
                {scenario.swot.opportunities.slice(0, 2).map((o, i) => (
                  <li key={i}>• {o}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-red-400 font-semibold mb-1">Menaces</p>
              <ul className="text-slate-300 space-y-1">
                {scenario.swot.threats.slice(0, 2).map((t, i) => (
                  <li key={i}>• {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {scenario.recommendations.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Recommandations</p>
          <ul className="space-y-2">
            {scenario.recommendations.slice(0, 3).map((rec, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-sky-400 mt-1">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}






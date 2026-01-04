"use client";

import { Scenario } from "../types";
// Note: Pour les graphiques avancés, installer recharts: npm install recharts
// Pour l'instant, on utilise des visualisations simples en CSS

interface ScenarioComparisonProps {
  scenarios: Scenario[];
  selectedIds: string[];
}

export function ScenarioComparison({ scenarios, selectedIds }: ScenarioComparisonProps) {
  const selected = scenarios.filter(s => selectedIds.includes(s.id));
  
  if (selected.length < 2) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Sélectionnez au moins 2 scénarios pour les comparer</p>
      </div>
    );
  }

  // Préparer les données pour le graphique comparatif
  const comparisonData = selected.map(scenario => ({
    name: scenario.title,
    ROI: scenario.metrics.roi || 0,
    Coût: scenario.metrics.cost ? scenario.metrics.cost / 1000 : 0, // en milliers
    Durée: scenario.metrics.duration || 0,
    Risque: (scenario.metrics.risk || 0) * 10, // Pourcentage
    Impact: (scenario.metrics.impact || 0) * 10,
  }));

  const radarData = selected.map(scenario => ({
    scenario: scenario.title,
    ROI: scenario.metrics.roi || 0,
    'Risque inverse': 100 - ((scenario.metrics.risk || 0) * 10),
    Impact: (scenario.metrics.impact || 0) * 10,
    Probabilité: scenario.probability || 0,
  }));

  // Normaliser les valeurs pour la visualisation
  const normalize = (value: number, max: number) => Math.max(0, Math.min(100, (value / max) * 100));

  const maxRoi = Math.max(...selected.map(s => Math.abs(s.metrics.roi || 0)));
  const maxCost = Math.max(...selected.map(s => s.metrics.cost || 0));
  const maxDuration = Math.max(...selected.map(s => s.metrics.duration || 0));

  return (
    <div className="space-y-6">
      {/* Graphiques en barres simples */}
      <div className="bg-slate-900/40 rounded-2xl p-6 border border-slate-800">
        <h3 className="text-lg font-bold text-white mb-6">Comparaison des métriques</h3>
        
        {/* ROI */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-300">ROI (%)</span>
          </div>
          <div className="space-y-2">
            {selected.map((scenario) => {
              const roi = scenario.metrics.roi || 0;
              const width = normalize(Math.abs(roi), maxRoi || 100);
              return (
                <div key={scenario.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">{scenario.title}</span>
                    <span className={`font-bold ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {roi > 0 ? '+' : ''}{roi}%
                    </span>
                  </div>
                  <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${roi >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coût */}
        {maxCost > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-300">Coût (€)</span>
            </div>
            <div className="space-y-2">
              {selected.map((scenario) => {
                const cost = scenario.metrics.cost || 0;
                const width = normalize(cost, maxCost);
                return (
                  <div key={scenario.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">{scenario.title}</span>
                      <span className="font-bold text-slate-300">
                        {cost.toLocaleString()}€
                      </span>
                    </div>
                    <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Durée */}
        {maxDuration > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-300">Durée (mois)</span>
            </div>
            <div className="space-y-2">
              {selected.map((scenario) => {
                const duration = scenario.metrics.duration || 0;
                const width = normalize(duration, maxDuration);
                return (
                  <div key={scenario.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">{scenario.title}</span>
                      <span className="font-bold text-slate-300">{duration} mois</span>
                    </div>
                    <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tableau comparatif */}
      <div className="bg-slate-900/40 rounded-2xl p-6 border border-slate-800 overflow-x-auto">
        <h3 className="text-lg font-bold text-white mb-4">Tableau comparatif détaillé</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left p-3 text-slate-300">Métrique</th>
              {selected.map(s => (
                <th key={s.id} className="text-center p-3 text-slate-300">{s.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-800">
              <td className="p-3 text-slate-400">ROI</td>
              {selected.map(s => (
                <td key={s.id} className="text-center p-3 text-white">
                  {s.metrics.roi !== undefined ? `${s.metrics.roi > 0 ? '+' : ''}${s.metrics.roi}%` : 'N/A'}
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-800">
              <td className="p-3 text-slate-400">Coût</td>
              {selected.map(s => (
                <td key={s.id} className="text-center p-3 text-white">
                  {s.metrics.cost !== undefined ? `${s.metrics.cost.toLocaleString()}€` : 'N/A'}
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-800">
              <td className="p-3 text-slate-400">Durée (mois)</td>
              {selected.map(s => (
                <td key={s.id} className="text-center p-3 text-white">
                  {s.metrics.duration || 'N/A'}
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-800">
              <td className="p-3 text-slate-400">Risque (1-10)</td>
              {selected.map(s => (
                <td key={s.id} className="text-center p-3 text-white">
                  {s.metrics.risk !== undefined ? `${s.metrics.risk}/10` : 'N/A'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3 text-slate-400">Impact (1-10)</td>
              {selected.map(s => (
                <td key={s.id} className="text-center p-3 text-white">
                  {s.metrics.impact !== undefined ? `${s.metrics.impact}/10` : 'N/A'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}


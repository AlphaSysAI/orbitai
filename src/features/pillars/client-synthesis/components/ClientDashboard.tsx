"use client";

import { useState } from "react";
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Upload, Play, Eye, Trash2, AlertCircle } from "lucide-react";
import { FeedbackSource, FeedbackItem, MarketingAnalysis } from "../hooks/useClientSynthesis";

interface ClientDashboardProps {
  sources: FeedbackSource[];
  feedbackItems: FeedbackItem[];
  analyses: MarketingAnalysis[];
  activeAnalysis: MarketingAnalysis | null;
  isLoading: boolean;
  onRunAnalysis: (periodStart?: string, periodEnd?: string, sourceIds?: string[]) => Promise<any>;
  onLoadAnalysis: (id: string) => void;
  onImportClick: () => void;
  onViewAnalysis: () => void;
  onDeleteAnalysis?: (id: string) => Promise<void>;
  onDeleteAllAnalyses?: () => Promise<void>;
}

export function ClientDashboard({
  sources,
  feedbackItems,
  analyses,
  activeAnalysis,
  isLoading,
  onRunAnalysis,
  onLoadAnalysis,
  onImportClick,
  onViewAnalysis,
  onDeleteAnalysis,
  onDeleteAllAnalyses,
}: ClientDashboardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      console.log('🔍 [ClientDashboard] Démarrage analyse...');
      const analysis = await onRunAnalysis();
      console.log('✅ [ClientDashboard] Analyse terminée:', analysis);
      
      // Si l'analyse est réussie, naviguer vers la vue d'analyse
      if (analysis) {
        console.log('✅ [ClientDashboard] Navigation vers la vue d\'analyse');
        onViewAnalysis();
      }
    } catch (error: any) {
      console.error('❌ [ClientDashboard] Erreur lors de l\'analyse:', error);
      
      // Gestion spéciale des rate limits
      if (error.errorCode === 'RATE_LIMIT' && error.retryAfter) {
        const retrySeconds = Math.ceil(error.retryAfter);
        const message = `${error.message}\n\n${error.suggestion || ''}\n\nLe système va automatiquement réessayer dans ${retrySeconds} secondes...`;
        alert(message);
        
        // Proposer de réessayer automatiquement après le délai
        setTimeout(async () => {
          if (confirm(`Voulez-vous réessayer l'analyse maintenant ?`)) {
            await handleRunAnalysis();
          }
        }, retrySeconds * 1000);
      } else {
        alert(`❌ Erreur lors de l'analyse: ${error.message || 'Erreur inconnue'}\n\nVérifiez la console pour plus de détails.`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalFeedback = feedbackItems.length;
  const positiveCount = feedbackItems.filter(f => f.sentiment === 'positive').length;
  const negativeCount = feedbackItems.filter(f => f.sentiment === 'negative').length;
  const sentimentScore = totalFeedback > 0 
    ? ((positiveCount - negativeCount) / totalFeedback) * 100 
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard Marketing & Communication</h1>
          <p className="text-slate-400">Analysez les retours clients pour identifier les faiblesses et les leviers</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onImportClick}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition"
          >
            <Upload size={18} />
            Importer des retours
          </button>
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || totalFeedback === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={18} />
            {isAnalyzing ? 'Analyse en cours...' : 'Lancer l\'analyse'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Sources actives</span>
            <BarChart2 className="text-emerald-400" size={20} />
          </div>
          <div className="text-3xl font-bold text-white">{sources.filter(s => s.is_active).length}</div>
          <div className="text-xs text-slate-500 mt-1">{sources.length} au total</div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Retours collectés</span>
            <TrendingUp className="text-blue-400" size={20} />
          </div>
          <div className="text-3xl font-bold text-white">{totalFeedback}</div>
          <div className="text-xs text-slate-500 mt-1">Toutes sources confondues</div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Score de sentiment</span>
            {sentimentScore >= 0 ? (
              <TrendingUp className="text-green-400" size={20} />
            ) : (
              <TrendingDown className="text-red-400" size={20} />
            )}
          </div>
          <div className="text-3xl font-bold text-white">
            {sentimentScore > 0 ? '+' : ''}{sentimentScore.toFixed(0)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {positiveCount} positif / {negativeCount} négatif
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Analyses réalisées</span>
            <Lightbulb className="text-yellow-400" size={20} />
          </div>
          <div className="text-3xl font-bold text-white">{analyses.length}</div>
          <div className="text-xs text-slate-500 mt-1">Dernière: {analyses[0] ? new Date(analyses[0].created_at).toLocaleDateString('fr-FR') : '-'}</div>
        </div>
      </div>

      {/* Dernière analyse */}
      {activeAnalysis && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Dernière analyse</h2>
            <button
              onClick={onViewAnalysis}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-lg text-emerald-400 text-sm transition"
            >
              <Eye size={16} />
              Voir en détail
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Faiblesses */}
            <div>
              <h3 className="text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                <AlertTriangle size={16} />
                Faiblesses identifiées ({activeAnalysis.weaknesses?.length || 0})
              </h3>
              <div className="space-y-2">
                {(activeAnalysis.weaknesses || []).slice(0, 3).map((weakness, idx) => (
                  <div key={idx} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <div className="text-sm font-medium text-white">{weakness.title}</div>
                    <div className="text-xs text-slate-400 mt-1">{weakness.description.substring(0, 100)}...</div>
                    <div className="text-xs text-red-400 mt-2">
                      Gravité: {weakness.severity} • {weakness.frequency} mentions
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Leviers */}
            <div>
              <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                <Lightbulb size={16} />
                Leviers identifiés ({activeAnalysis.levers?.length || 0})
              </h3>
              <div className="space-y-2">
                {(activeAnalysis.levers || []).slice(0, 3).map((lever, idx) => (
                  <div key={idx} className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <div className="text-sm font-medium text-white">{lever.title}</div>
                    <div className="text-xs text-slate-400 mt-1">{lever.description.substring(0, 100)}...</div>
                    <div className="text-xs text-emerald-400 mt-2">
                      Priorité: {lever.priority} • Type: {lever.type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Métriques */}
          <div className="mt-6 grid grid-cols-3 gap-4 pt-6 border-t border-slate-800">
            <div>
              <div className="text-xs text-slate-400">Sentiment global</div>
              <div className="text-lg font-bold text-white">
                {activeAnalysis.overall_sentiment > 0 ? '+' : ''}
                {(activeAnalysis.overall_sentiment * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Satisfaction</div>
              <div className="text-lg font-bold text-white">
                {(activeAnalysis.satisfaction_score * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">NPS estimé</div>
              <div className="text-lg font-bold text-white">
                {activeAnalysis.nps_score > 0 ? '+' : ''}{activeAnalysis.nps_score.toFixed(0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historique des analyses */}
      {analyses.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Historique des analyses</h2>
            {onDeleteAllAnalyses && (
              <button
                onClick={async () => {
                  if (confirm('Êtes-vous sûr de vouloir supprimer toutes les analyses ? Cette action est irréversible.')) {
                    try {
                      await onDeleteAllAnalyses();
                    } catch (error: any) {
                      alert(`❌ Erreur lors de la suppression: ${error.message}`);
                    }
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 rounded-lg text-red-400 text-sm transition"
                title="Supprimer toutes les analyses"
              >
                <Trash2 size={16} />
                Tout supprimer
              </button>
            )}
          </div>
          <div className="space-y-2">
            {analyses.slice(0, 5).map((analysis) => (
              <div
                key={analysis.id}
                className="flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition group"
              >
                <div
                  onClick={() => onLoadAnalysis(analysis.id)}
                  className="flex-1 cursor-pointer"
                >
                  <div className="text-sm font-medium text-white">
                    Analyse du {new Date(analysis.created_at).toLocaleDateString('fr-FR', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {analysis.total_feedback_analyzed} retours analysés • {analysis.weaknesses?.length || 0} faiblesses • {analysis.levers?.length || 0} leviers
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLoadAnalysis(analysis.id)}
                    className="text-emerald-400 hover:text-emerald-300 text-sm transition"
                  >
                    Voir →
                  </button>
                  {onDeleteAnalysis && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm('Êtes-vous sûr de vouloir supprimer cette analyse ? Cette action est irréversible.')) {
                          setDeletingId(analysis.id);
                          try {
                            await onDeleteAnalysis(analysis.id);
                          } catch (error: any) {
                            alert(`❌ Erreur lors de la suppression: ${error.message}`);
                          } finally {
                            setDeletingId(null);
                          }
                        }
                      }}
                      disabled={deletingId === analysis.id}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition disabled:opacity-50"
                      title="Supprimer cette analyse"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message si pas de données */}
      {totalFeedback === 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <BarChart2 className="mx-auto text-slate-600 mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">Aucun retour client collecté</h3>
          <p className="text-slate-400 mb-6">
            Importez vos premiers retours clients pour commencer l'analyse marketing et communication
          </p>
          <button
            onClick={onImportClick}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium transition"
          >
            Importer des retours
          </button>
        </div>
      )}
    </div>
  );
}


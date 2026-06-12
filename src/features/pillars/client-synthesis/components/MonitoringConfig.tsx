"use client";

import { useState } from "react";
import { Plus, Trash2, ExternalLink, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

interface MonitoringSource {
  id: string;
  source_type: string;
  source_name: string;
  monitoring_url: string | null;
  auto_monitoring: boolean;
  monitoring_frequency: string;
  last_sync_at: string | null;
  is_active: boolean;
}

interface MonitoringConfigProps {
  sources: MonitoringSource[];
  userId: string;
  onAddSource: (config: {
    source_type: string;
    source_name: string;
    monitoring_url: string;
    auto_monitoring: boolean;
    monitoring_frequency: string;
  }) => Promise<void>;
  onUpdateSource: (id: string, config: Partial<MonitoringSource>) => Promise<void>;
  onDeleteSource: (id: string) => Promise<void>;
  onTestConnection: (id: string, userId: string) => Promise<boolean>;
  onRefresh?: () => Promise<void>; // Callback pour recharger les données
  isLoading: boolean;
}

const SOURCE_TYPES = [
  { id: 'review', label: 'Google Reviews', icon: '⭐', urlPlaceholder: 'https://www.google.com/maps/place/...' },
  { id: 'review', label: 'Trustpilot', icon: '💬', urlPlaceholder: 'https://www.trustpilot.com/review/...' },
  { id: 'social', label: 'Facebook', icon: '📘', urlPlaceholder: 'https://www.facebook.com/...' },
  { id: 'social', label: 'Instagram', icon: '📷', urlPlaceholder: 'https://www.instagram.com/...' },
  { id: 'social', label: 'Twitter/X', icon: '🐦', urlPlaceholder: 'https://twitter.com/...' },
  { id: 'other', label: 'Autre', icon: '🔗', urlPlaceholder: 'https://...' },
];

export function MonitoringConfig({
  sources,
  userId,
  onAddSource,
  onUpdateSource,
  onDeleteSource,
  onTestConnection,
  onRefresh,
  isLoading,
}: MonitoringConfigProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSource, setNewSource] = useState({
    source_type: 'review',
    source_name: '',
    monitoring_url: '',
    auto_monitoring: true,
    monitoring_frequency: 'daily',
  });
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newSource.source_name || !newSource.monitoring_url) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    await onAddSource(newSource);
    setShowAddForm(false);
    setNewSource({
      source_type: 'review',
      source_name: '',
      monitoring_url: '',
      auto_monitoring: true,
      monitoring_frequency: 'daily',
    });
  };

  const handleTest = async (id: string) => {
    if (!userId) {
      alert('❌ Erreur: utilisateur non identifié. Veuillez vous reconnecter.');
      return;
    }

    // Vérifier que la source existe dans la liste
    const source = sources.find(s => s.id === id);
    console.log('🔍 [handleTest] Source cherchée:', id);
    console.log('🔍 [handleTest] Toutes les sources:', sources);
    console.log('🔍 [handleTest] Source trouvée:', source);
    console.log('🔍 [handleTest] UserId:', userId);
    
    if (!source) {
      alert(`❌ Erreur: source introuvable dans la liste locale (ID: ${id}).\n\nNombre de sources: ${sources.length}\nIDs disponibles: ${sources.map(s => s.id).join(', ')}\n\nVeuillez rafraîchir la page.`);
      return;
    }

    setTestingId(id);
    try {
      const requestBody = {
        sourceId: id,
        userId: userId,
      };
      console.log('📤 [handleTest] Envoi requête:', requestBody);
      
      const response = await fetch('/api/client-feedback/fetch-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      console.log('📥 [handleTest] Réponse API:', data);
      setTestingId(null);
      
      if (data.success) {
        if (data.requires_api) {
          // URL valide mais nécessite une API
          alert(`✅ URL valide !\n\n${data.message}\n\nLa source est enregistrée et sera utilisée automatiquement une fois l'API configurée.`);
        } else if (data.fetched !== undefined && data.fetched > 0) {
          // Des avis ont été récupérés
          console.log(`✅ [handleTest] ${data.fetched} avis récupérés, rechargement des données...`);
          // Recharger les données si callback disponible
          if (onRefresh) {
            await onRefresh();
          }
          alert(`✅ Connexion réussie ! ${data.fetched} commentaire(s) récupéré(s) et enregistré(s).`);
        } else if (data.fetched === 0) {
          // Recharger quand même pour voir si des avis existent
          if (onRefresh) {
            await onRefresh();
          }
          alert(`ℹ️ ${data.message || 'Aucun nouvel avis récupéré. Les avis existants ont peut-être déjà été importés.'}`);
        } else if (data.message) {
          alert(`ℹ️ ${data.message}`);
        } else {
          alert('✅ URL valide ! La source est enregistrée.');
        }
      } else {
        // Erreur réelle - afficher plus de détails avec les infos de debug
        console.error('Erreur fetch-monitoring:', data);
        const errorMsg = data.error || data.message || 'Échec de la connexion';
        const debugInfo = data.debug ? `\n\n🔍 Debug:\n${JSON.stringify(data.debug, null, 2)}` : '';
        alert(`❌ ${errorMsg}${debugInfo}\n\nSource ID: ${id}\nUser ID: ${userId}`);
      }
    } catch (error: any) {
      setTestingId(null);
      alert(`❌ Erreur: ${error.message || 'Échec de la connexion'}`);
    }
  };

  const monitoringSources = sources.filter(s => s.monitoring_url);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Surveillance automatique</h2>
          <p className="text-slate-400">
            Configurez les sources à surveiller automatiquement. L'IA récupérera les commentaires en temps réel lors des analyses.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition"
        >
          <Plus size={18} />
          Ajouter une source
        </button>
      </div>

      {showAddForm && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Nouvelle source de surveillance</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Type de source
            </label>
            <select
              value={newSource.source_type}
              onChange={(e) => setNewSource({ ...newSource, source_type: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="review">Avis clients</option>
              <option value="social">Réseaux sociaux</option>
              <option value="other">Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nom de la source
            </label>
            <input
              type="text"
              value={newSource.source_name}
              onChange={(e) => setNewSource({ ...newSource, source_name: e.target.value })}
              placeholder="Ex: Google Reviews - Mon Entreprise"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              URL à surveiller
            </label>
            <input
              type="url"
              value={newSource.monitoring_url}
              onChange={(e) => setNewSource({ ...newSource, monitoring_url: e.target.value })}
              placeholder="https://www.google.com/maps/place/Nom-Entreprise/@..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
            />
            <p className="text-xs text-slate-500 mt-1">
              L'URL de la page contenant les avis/commentaires à surveiller
            </p>
            <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-400 font-medium mb-1">💡 Comment obtenir l'URL Google Maps :</p>
              <ol className="text-xs text-slate-400 space-y-1 ml-4 list-decimal">
                <li>Allez sur <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google Maps</a></li>
                <li>Recherchez votre entreprise</li>
                <li>Cliquez sur l'entreprise dans les résultats</li>
                <li>Copiez l'URL complète de la page (elle contient "/place/")</li>
              </ol>
              <p className="text-xs text-orange-400 mt-2 font-medium">
                ⚠️ Ne pas utiliser une URL de recherche Google (google.com/search)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newSource.auto_monitoring}
                onChange={(e) => setNewSource({ ...newSource, auto_monitoring: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-600"
              />
              <span className="text-sm text-slate-300">Surveillance automatique</span>
            </label>

            {newSource.auto_monitoring && (
              <select
                value={newSource.monitoring_frequency}
                onChange={(e) => setNewSource({ ...newSource, monitoring_frequency: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-white text-sm"
              >
                <option value="hourly">Toutes les heures</option>
                <option value="daily">Quotidiennement</option>
                <option value="weekly">Hebdomadaire</option>
              </select>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={isLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition disabled:opacity-50"
            >
              Ajouter
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des sources configurées */}
      <div className="space-y-4">
        {monitoringSources.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-400 mb-4">Aucune source de surveillance configurée</p>
            <p className="text-sm text-slate-500">
              Ajoutez une source pour commencer la surveillance automatique des avis et commentaires
            </p>
          </div>
        ) : (
          monitoringSources.map((source) => (
            <div
              key={source.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-white">{source.source_name}</h3>
                    {source.is_active ? (
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                        Actif
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-500/20 text-slate-400 text-xs rounded-full">
                        Inactif
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                      <ExternalLink size={14} />
                      <a
                        href={source.monitoring_url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-emerald-400 transition break-all"
                      >
                        {source.monitoring_url}
                      </a>
                    </div>

                    {source.auto_monitoring && (
                      <div className="flex items-center gap-4">
                        <span>Surveillance: {source.monitoring_frequency === 'hourly' ? 'Toutes les heures' : source.monitoring_frequency === 'daily' ? 'Quotidienne' : 'Hebdomadaire'}</span>
                        {source.last_sync_at && (
                          <span>Dernière synchro: {new Date(source.last_sync_at).toLocaleDateString('fr-FR')}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(source.id)}
                    disabled={testingId === source.id || isLoading || !userId}
                    className="p-2 hover:bg-slate-800 rounded-lg transition disabled:opacity-50"
                    title="Tester la connexion"
                  >
                    {testingId === source.id ? (
                      <RefreshCw size={18} className="text-slate-400 animate-spin" />
                    ) : (
                      <RefreshCw size={18} className="text-slate-400" />
                    )}
                  </button>
                  <button
                    onClick={() => onUpdateSource(source.id, { is_active: !source.is_active })}
                    className="p-2 hover:bg-slate-800 rounded-lg transition"
                    title={source.is_active ? 'Désactiver' : 'Activer'}
                  >
                    {source.is_active ? (
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    ) : (
                      <XCircle size={18} className="text-slate-500" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Êtes-vous sûr de vouloir supprimer cette source ?')) {
                        onDeleteSource(source.id);
                      }
                    }}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition"
                    title="Supprimer"
                  >
                    <Trash2 size={18} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


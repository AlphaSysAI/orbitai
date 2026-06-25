// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useState } from "react";
import { ArrowLeft, Upload, FileText, Mail, MessageSquare, Star, Users, Phone, Trash2 } from "lucide-react";
import type { FeedbackSource } from "../hooks/useClientSynthesis";

interface ImportViewProps {
  sources: FeedbackSource[];
  onImport: (
    sourceType: string,
    sourceName: string,
    items: Array<{ content: string; date?: string; [key: string]: any }>
  ) => Promise<any>;
  onDeleteSource: (sourceId: string) => Promise<void>;
  isLoading: boolean;
  onBack: () => void;
}

const SOURCE_TYPES = [
  { id: 'email', label: 'Emails', icon: Mail, description: 'Emails clients' },
  { id: 'ticket', label: 'Tickets support', icon: MessageSquare, description: 'Zendesk, Freshdesk, etc.' },
  { id: 'review', label: 'Avis clients', icon: Star, description: 'Trustpilot, Google Reviews, etc.' },
  { id: 'survey', label: 'Enquêtes', icon: FileText, description: 'Enquêtes de satisfaction' },
  { id: 'social', label: 'Réseaux sociaux', icon: Users, description: 'Twitter, Facebook, LinkedIn' },
  { id: 'chat', label: 'Chat', icon: MessageSquare, description: 'Chat en ligne, support live' },
  { id: 'call', label: 'Appels', icon: Phone, description: 'Transcripts d\'appels' },
  { id: 'other', label: 'Autre', icon: FileText, description: 'Autres sources' },
];

export function ImportView({ sources, onImport, onDeleteSource, isLoading, onBack }: ImportViewProps) {
  const [selectedType, setSelectedType] = useState<string>('');
  const [sourceName, setSourceName] = useState('');
  const [items, setItems] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!selectedType || !sourceName || !items.trim()) {
      alert('Veuillez remplir tous les champs');
      return;
    }

    // Parser les items (format CSV ou JSON ou texte brut)
    let parsedItems: Array<{ content: string; date?: string; [key: string]: any }> = [];
    
    try {
      // Essayer JSON d'abord
      parsedItems = JSON.parse(items);
      if (!Array.isArray(parsedItems)) {
        throw new Error('JSON doit être un tableau');
      }
    } catch {
      // Sinon, traiter comme texte brut (un retour par ligne)
      parsedItems = items.split('\n')
        .filter(line => line.trim())
        .map((line, idx) => ({
          content: line.trim(),
          date: new Date().toISOString(),
        }));
    }

    setImporting(true);
    try {
      const result = await onImport(selectedType, sourceName, parsedItems);
      
      // Afficher un message détaillé si disponible
      if (result?.message) {
        alert(`✅ ${result.message}`);
      } else if (result?.imported !== undefined) {
        const duplicatesInfo = result.duplicates > 0 
          ? ` (${result.duplicates} doublon(s) ignoré(s))`
          : '';
        const totalInfo = result.totalInSource 
          ? `\n\nTotal dans la source : ${result.totalInSource}`
          : '';
        alert(`✅ ${result.imported} retour(s) importé(s) avec succès${duplicatesInfo}${totalInfo}`);
      } else {
        alert(`✅ ${parsedItems.length} retours importés avec succès !`);
      }
      
      setItems('');
      setSourceName('');
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const selectedSourceType = SOURCE_TYPES.find(t => t.id === selectedType);
  const Icon = selectedSourceType?.icon || FileText;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-800 rounded-lg transition"
        >
          <ArrowLeft className="text-slate-400" size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">Importer des retours clients</h1>
          <p className="text-slate-400">Ajoutez vos retours depuis différentes sources</p>
        </div>
      </div>

      {/* Sources existantes */}
      {sources.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Sources importées manuellement</h2>
          <p className="text-sm text-slate-400 mb-4">
            Ces sources ont été créées lors d'imports manuels. Vous pouvez les supprimer avec tous leurs retours associés.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sources
              .filter(source => !source.monitoring_url || !source.auto_monitoring) // Seulement les sources manuelles
              .map((source) => (
                <div key={source.id} className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{source.source_name}</div>
                    <div className="text-xs text-slate-400 mt-1 capitalize">{source.source_type}</div>
                    <div className="text-xs text-slate-500 mt-1">{source.total_items} retours</div>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm(`Êtes-vous sûr de vouloir supprimer la source "${source.source_name}" et tous ses ${source.total_items} retours ?`)) {
                        try {
                          await onDeleteSource(source.id);
                          alert(`✅ Source "${source.source_name}" supprimée avec succès`);
                        } catch (error: any) {
                          alert(`❌ Erreur: ${error.message}`);
                        }
                      }
                    }}
                    className="ml-4 p-2 hover:bg-red-500/20 rounded-lg transition text-red-400 hover:text-red-300"
                    title="Supprimer cette source et tous ses retours"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
          </div>
          {sources.filter(source => !source.monitoring_url || !source.auto_monitoring).length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Aucune source importée manuellement</p>
          )}
        </div>
      )}

      {/* Formulaire d'import */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-6">
        <h2 className="text-lg font-bold text-white">Nouveau import</h2>

        {/* Type de source */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Type de source
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SOURCE_TYPES.map((type) => {
              const IconComp = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 rounded-lg border-2 transition ${
                    selectedType === type.id
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <IconComp className={`mx-auto mb-2 ${
                    selectedType === type.id ? 'text-emerald-400' : 'text-slate-400'
                  }`} size={24} />
                  <div className={`text-xs font-medium ${
                    selectedType === type.id ? 'text-white' : 'text-slate-400'
                  }`}>
                    {type.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nom de la source */}
        {selectedType && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nom de la source
              </label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder={`Ex: ${selectedSourceType?.description}`}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Contenu */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Retours clients
              </label>
              <div className="text-xs text-slate-400 mb-2">
                Format: JSON array ou texte brut (un retour par ligne)
              </div>
              <textarea
                value={items}
                onChange={(e) => setItems(e.target.value)}
                placeholder={`Exemple JSON:
[
  {"content": "Super produit !", "date": "2024-01-15"},
  {"content": "Service client à améliorer", "date": "2024-01-16"}
]

Ou texte brut:
Super produit !
Service client à améliorer
Expérience utilisateur géniale`}
                rows={12}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
              />
            </div>

            {/* Bouton import */}
            <button
              onClick={handleImport}
              disabled={importing || isLoading || !sourceName.trim() || !items.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={18} />
              {importing ? 'Import en cours...' : 'Importer les retours'}
            </button>
          </>
        )}
      </div>

      {/* Aide */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <h3 className="text-sm font-bold text-blue-400 mb-2">💡 Astuce</h3>
        <p className="text-sm text-slate-300">
          L'IA analysera automatiquement chaque retour pour extraire le sentiment, la catégorie, l'urgence et les sujets principaux.
          Vous pourrez ensuite lancer une analyse complète pour identifier les faiblesses et les leviers marketing/com.
        </p>
      </div>
    </div>
  );
}


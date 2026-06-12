"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, BarChart3, Plus } from "lucide-react";
import { useDecisionSimulation } from "./hooks/useDecisionSimulation";
import { ConversationGuide } from "./components/ConversationGuide";
import { ScenarioCard } from "./components/ScenarioCard";
import { ScenarioComparison } from "./components/ScenarioComparison";
import { SimulationList } from "./components/SimulationList";
import { type PillarId, PILLARS } from "../types";

interface DecisionPillarProps {
  user: { id: string; email?: string };
  activeTab: "dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview";
  onPillarChange?: (pillarId: PillarId) => void;
  onTabChange?: (tab: "dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview") => void;
  onLogout?: () => void;
}

export function DecisionPillar({ user, activeTab, onTabChange }: DecisionPillarProps) {
  const {
    simulations,
    activeSimulation,
    conversation,
    isAnalyzing,
    currentContext,
    uploadedDocuments,
    createNewSimulation,
    saveSimulation,
    sendMessage,
    deleteSimulation,
    loadSimulation,
    uploadDocument,
    removeDocument,
  } = useDecisionSimulation(user.id);

  const [view, setView] = useState<'list' | 'conversation' | 'scenarios' | 'compare'>('list');
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const [isCreatingAuto, setIsCreatingAuto] = useState(false);
  const [lastActiveTab, setLastActiveTab] = useState<"dashboard" | "library" | "settings" | null>(null);

  const handleCreateNew = useCallback(async () => {
    const id = await createNewSimulation();
    if (id) {
      setView('conversation');
    }
  }, [createNewSimulation]);

  // Gérer les onglets : "Simulation" renvoie sur la simulation en cours, "Archives" affiche l'historique
  useEffect(() => {
    // Ne déclencher que si l'onglet change réellement
    if (lastActiveTab === activeTab) return;
    setLastActiveTab(activeTab);
    
    if (activeTab === "dashboard") {
      // Onglet "Simulation" : renvoyer sur la simulation en cours ou créer une nouvelle si aucune n'existe
      if (activeSimulation) {
        // Si une simulation est active, afficher la vue conversation
        setView('conversation');
      } else if (!isCreatingAuto) {
        // Sinon, créer une nouvelle simulation
        setIsCreatingAuto(true);
        handleCreateNew().finally(() => {
          setIsCreatingAuto(false);
        });
      }
    } else if (activeTab === "library") {
      // Onglet "Archives" : afficher l'historique
      setView('list');
    }
  }, [activeTab, activeSimulation, isCreatingAuto, handleCreateNew, lastActiveTab]);

  // Rediriger vers la liste si activeSimulation devient null (suppression) ou si on est sur une vue qui n'existe plus
  useEffect(() => {
    // Si toutes les simulations sont supprimées ET qu'on est sur la liste (Archives), créer automatiquement une nouvelle
    // Protection contre la boucle infinie : on vérifie qu'on n'est pas déjà en train de créer
    if (simulations.length === 0 && view === 'list' && !isCreatingAuto && !activeSimulation && activeTab === "library") {
      setIsCreatingAuto(true);
      handleCreateNew().finally(() => {
        // Reset après un court délai pour éviter les créations multiples rapides
        setTimeout(() => setIsCreatingAuto(false), 1000);
      });
      return;
    }

    // Si on supprime une simulation alors qu'on était en train de la consulter, retourner à la liste
    if (!activeSimulation && view !== 'list' && simulations.length > 0) {
      setView('list');
    }
    
    // Si on est sur une vue de simulation mais que activeSimulation n'existe pas, retourner à la liste
    if ((view === 'conversation' || view === 'scenarios' || view === 'compare') && !activeSimulation && simulations.length > 0) {
      setView('list');
    }
  }, [activeSimulation, view, simulations.length, handleCreateNew, isCreatingAuto]);

  const handleSelectSimulation = (id: string) => {
    loadSimulation(id);
    const sim = simulations.find(s => s.id === id);
    if (sim) {
      if (sim.status === 'ready' && sim.scenarios.length > 0) {
        setView('scenarios');
      } else {
        setView('conversation');
      }
    }
  };

  const handleScenarioSelect = (id: string) => {
    setSelectedScenarios(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const pillarConfig = PILLARS.find((p) => p.id === "decision-simulation");
  const pillarColor = pillarConfig?.color.replace('text-', '') || 'sky-400';
  const pillarLabel = 'Strategy Expert';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white">
      <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20">
        <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
          <span className={`${pillarConfig?.color || 'text-sky-400'} border-b-2 border-${pillarColor} py-5`}>
            {pillarConfig?.name || "Simulation Décisionnelle"}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative">
      {view === 'list' && (
        <SimulationList
            simulations={simulations}
            activeId={activeSimulation?.id || null}
            onSelect={handleSelectSimulation}
            onDelete={async (id, e) => {
              const wasActive = activeSimulation?.id === id;
              const willRemainEmpty = simulations.length === 1;
              
              await deleteSimulation(id);
              
              // Si c'était la dernière simulation, créer automatiquement une nouvelle
              if (willRemainEmpty) {
                setSelectedScenarios([]);
                setIsCreatingAuto(true);
                await handleCreateNew();
                setIsCreatingAuto(false);
              } else if (wasActive) {
                // Si on supprime une simulation active mais qu'il en reste, retourner à la liste
                setSelectedScenarios([]);
                setView('list');
              }
            }}
          />
      )}

      {view === 'conversation' && activeSimulation && (
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">{activeSimulation.title}</h2>
            <div className="flex gap-2">
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm transition"
              >
                <Plus size={16} />
                Nouvelle simulation
              </button>
              {activeSimulation.scenarios.length > 0 && (
                <button
                  onClick={() => setView('scenarios')}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-white text-sm transition"
                >
                  Voir Scénarios
                </button>
              )}
            </div>
          </div>

          <ConversationGuide
            messages={conversation}
            isLoading={isAnalyzing}
            onSendMessage={sendMessage}
            status={activeSimulation.status}
            uploadedDocuments={uploadedDocuments}
            scenarios={activeSimulation.scenarios || []}
            simulationTitle={activeSimulation.title}
            onFileUpload={async (e) => {
              const files = e.target.files;
              if (!files) return;
              for (let i = 0; i < files.length; i++) {
                await uploadDocument(files[i]);
              }
              e.target.value = '';
            }}
            onRemoveDocument={removeDocument}
          />
        </div>
      )}

      {view === 'scenarios' && activeSimulation && (
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setView('list')}
                className="text-slate-400 hover:text-white transition"
              >
                ← Historique des analyses
              </button>
              <h2 className="text-2xl font-bold text-white">{activeSimulation.title}</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('conversation')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white text-sm transition flex items-center gap-2"
              >
                <MessageSquare size={16} />
                Conversation
              </button>
              {selectedScenarios.length >= 2 && (
                <button
                  onClick={() => setView('compare')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm transition flex items-center gap-2"
                >
                  <BarChart3 size={16} />
                  Comparer ({selectedScenarios.length})
                </button>
              )}
            </div>
          </div>

          <div className="mb-4 p-4 bg-sky-600/10 border border-sky-500/30 rounded-xl">
            <p className="text-sm text-slate-300">
              <strong>Sélectionnez 2 scénarios ou plus</strong> pour les comparer côte à côte et obtenir une analyse détaillée.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeSimulation.scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                isSelected={selectedScenarios.includes(scenario.id)}
                onSelect={handleScenarioSelect}
                onCompare={true}
              />
            ))}
          </div>
        </div>
      )}

      {view === 'compare' && activeSimulation && (
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setView('scenarios')}
                className="text-slate-400 hover:text-white transition"
              >
                ← Scénarios
              </button>
              <h2 className="text-2xl font-bold text-white">Comparaison de scénarios</h2>
            </div>
          </div>

          <ScenarioComparison
            scenarios={activeSimulation.scenarios}
            selectedIds={selectedScenarios}
          />
        </div>
      )}
      </main>
    </div>
  );
}

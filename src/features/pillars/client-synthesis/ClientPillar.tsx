"use client";

import { useState } from "react";
import { type PillarId, PILLARS } from "../types";
import { useClientSynthesis } from "./hooks/useClientSynthesis";
import { ClientDashboard } from "./components/ClientDashboard";
import { AnalysisView } from "./components/AnalysisView";
import { ImportView } from "./components/ImportView";
import { MonitoringConfig } from "./components/MonitoringConfig";

interface ClientPillarProps {
  user: { id: string; email?: string };
  activeTab: "dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview" | "monitoring";
  onPillarChange?: (pillarId: PillarId) => void;
  onTabChange?: (tab: "dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview" | "monitoring") => void;
  onLogout?: () => void;
}

export function ClientPillar({ user, activeTab, onTabChange }: ClientPillarProps) {
  const {
    sources,
    feedbackItems,
    analyses,
    activeAnalysis,
    isLoading,
    importFeedback,
    runAnalysis,
    loadAnalysis,
    fetchFeedback,
    refreshAnalyses,
    addMonitoringSource,
    updateMonitoringSource,
    deleteMonitoringSource,
    testMonitoringConnection,
    deleteFeedbackSource,
    deleteAnalysis,
    deleteAllAnalyses,
  } = useClientSynthesis(user.id);

  const pillarConfig = PILLARS.find((p) => p.id === "client-synthesis");
  const pillarColor = pillarConfig?.color.replace('text-', '') || 'emerald-400';
  const pillarLabel = 'Marketing Expert';

  // Adapter les onglets système aux vues internes
  const effectiveView = activeTab === "library" ? 'import' : 
                        activeTab === "analyze" ? 'analysis' : 
                        activeTab === "monitoring" ? 'monitoring' :
                        'dashboard';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white">
      <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20">
        <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
          <span className={`${pillarConfig?.color || 'text-emerald-400'} border-b-2 border-${pillarColor} py-5`}>
            {pillarConfig?.name || "Synthèse Intelligente Client"}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative">
        {effectiveView === 'dashboard' && (
          <ClientDashboard
            sources={sources}
            feedbackItems={feedbackItems}
            analyses={analyses}
            activeAnalysis={activeAnalysis}
            isLoading={isLoading}
            onRunAnalysis={runAnalysis}
            onLoadAnalysis={loadAnalysis}
            onImportClick={() => {
              if (onTabChange) {
                onTabChange('library');
              }
            }}
            onViewAnalysis={() => {
              if (onTabChange) {
                onTabChange('analyze');
              }
            }}
            onDeleteAnalysis={deleteAnalysis}
            onDeleteAllAnalyses={deleteAllAnalyses}
          />
        )}

        {effectiveView === 'analysis' && activeAnalysis && (
          <AnalysisView
            analysis={activeAnalysis}
            onBack={() => {
              if (onTabChange) {
                onTabChange('dashboard');
              }
            }}
          />
        )}

        {effectiveView === 'import' && (
          <ImportView
            sources={sources}
            onImport={importFeedback}
            onDeleteSource={deleteFeedbackSource}
            isLoading={isLoading}
            onBack={() => {
              if (onTabChange) {
                onTabChange('dashboard');
              }
            }}
          />
        )}

        {effectiveView === 'monitoring' && (
          <MonitoringConfig
            sources={sources}
            userId={user.id}
            onAddSource={addMonitoringSource}
            onUpdateSource={updateMonitoringSource}
            onDeleteSource={deleteMonitoringSource}
            onTestConnection={testMonitoringConnection}
            onRefresh={async () => {
              await fetchSources();
              await fetchFeedback();
            }}
            isLoading={isLoading}
          />
        )}
      </main>
    </div>
  );
}

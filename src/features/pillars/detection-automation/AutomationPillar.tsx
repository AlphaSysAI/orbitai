"use client";

import { useState } from "react";
import { type PillarId, PILLARS } from "../types";
import { useAutomation } from "./hooks/useAutomation";
import { AutomationDashboard } from "./components/AutomationDashboard";
import { TaskList } from "./components/TaskList";
import { AutomationList } from "./components/AutomationList";
import { AutomationAnalyzer } from "./components/AutomationAnalyzer";

interface AutomationPillarProps {
  user: { id: string; email?: string };
  activeTab: "overview" | "tasks" | "automations" | "analyze" | "library" | "settings" | "dashboard";
  onPillarChange?: (pillarId: PillarId) => void;
  onTabChange?: (tab: "overview" | "tasks" | "automations" | "analyze" | "library" | "settings" | "dashboard") => void;
  onLogout?: () => void;
}

export function AutomationPillar({ user, activeTab }: AutomationPillarProps) {
  const {
    tasks,
    automations,
    activeTask,
    activeAutomation,
    stats,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomationStatus,
    loadTask,
    loadAutomation,
    refreshTasks,
    refreshStats,
  } = useAutomation(user.id);

  const pillarConfig = PILLARS.find((p) => p.id === "detection-automation");
  const pillarColor = pillarConfig?.color.replace('text-', '') || 'violet-400';
  const pillarLabel = 'Automation Expert';

  // Fonction pour déclencher l'analyse de l'historique
  const analyzeHistory = async () => {
    const response = await fetch("/api/analyze-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        days: 30,
      }),
    });
    const data = await response.json();
    if (data.success) {
      // Rafraîchir les données
      await Promise.all([
        refreshTasks(),
        refreshStats(),
      ]);
    }
    return data;
  };

  const renderContent = () => {
    // Si aucun onglet spécifique n'est sélectionné ou si c'est overview, afficher la vue d'ensemble
    if (!activeTab || activeTab === "overview" || activeTab === "dashboard" || activeTab === "library" || activeTab === "settings") {
        return (
          <AutomationDashboard
            stats={stats}
            tasks={tasks}
            automations={automations}
            isLoading={isLoading}
            onAnalyzeHistory={analyzeHistory}
            userId={user.id}
          />
        );
    }

    switch (activeTab) {
      case "tasks":
        return (
          <TaskList
            tasks={tasks}
            activeTask={activeTask}
            onTaskSelect={loadTask}
            onTaskUpdate={updateTask}
            onTaskDelete={deleteTask}
            onTaskCreate={createTask}
            isLoading={isLoading}
          />
        );
      case "automations":
        return (
          <AutomationList
            automations={automations}
            activeAutomation={activeAutomation}
            onAutomationSelect={loadAutomation}
            onAutomationCreate={createAutomation}
            onAutomationUpdate={updateAutomation}
            onAutomationDelete={deleteAutomation}
            onToggleStatus={toggleAutomationStatus}
            isLoading={isLoading}
          />
        );
      case "analyze":
        return (
          <AutomationAnalyzer
            tasks={tasks}
            automations={automations}
            onCreateAutomation={createAutomation}
            onUpdateTask={updateTask}
          />
        );
      default:
        return (
          <AutomationDashboard
            stats={stats}
            tasks={tasks}
            automations={automations}
            isLoading={isLoading}
            onAnalyzeHistory={analyzeHistory}
          />
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white">
      <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20">
        <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
          <span className={`${pillarConfig?.color || 'text-violet-400'} border-b-2 border-${pillarColor} py-5`}>
            {pillarConfig?.name || "Détection & Automatisation"}
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative">
        {renderContent()}
      </main>
    </div>
  );
}

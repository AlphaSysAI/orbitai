// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { PILLARS } from "@/features/pillars/types";
import { GlobalDashboard } from "@/features/pillars/components/GlobalDashboard";
import { CopilotPillar } from "@/features/pillars/copilot-transmission/CopilotPillar";
import { AutomationPillar } from "@/features/pillars/detection-automation/AutomationPillar";
import { DecisionPillar } from "@/features/pillars/decision-simulation/DecisionPillar";
import { EmotionalPillar } from "@/features/pillars/emotional-ai/EmotionalPillar";
import { ClientPillar } from "@/features/pillars/client-synthesis/ClientPillar";
import { useOrganizationModules } from "@/hooks/useOrganizationModules";
import { OrganizationSettingsPanel } from "@/features/organization/components/OrganizationSettingsPanel";
import { useOrgRole } from "@/features/organization/hooks/useOrgRole";
import { SaasBrandTitle } from "@/components/branding/SaasBrandTitle";
import {
  getPrimaryBusinessModule,
  resolveSaasBrandFromModules,
} from "@/lib/organizations/saas-branding";
import { ORG_MODULE_NAMES } from "@/lib/organizations/types";
import { useCallback } from "react";
import {
  useDashboardShell,
  type DashboardTab,
} from "@/features/pillars/components/DashboardShellContext";

export default function OrbitDashboard() {
  const { isLoading: isModulesLoading, enabledModules } =
    useOrganizationModules();
  const { isOrgAdmin, isLoading: isOrgRoleLoading } = useOrgRole();
  const {
    user,
    activePillar,
    activeTab,
    handlePillarChange,
    handleTabChange,
    handleLogout,
    activeThreadId,
    setCopilotThreads,
    setActiveThreadId,
    setDeleteThreadFn,
  } = useDashboardShell();

  const handleThreadsUpdate = useCallback(
    (
      threads: Array<{ id_thread: string; title: string; created_at?: string }>,
      activeId: string | null,
      deleteFn?: (threadId: string, e: React.MouseEvent) => Promise<void>,
    ) => {
      setCopilotThreads(threads);
      setActiveThreadId(activeId);
      if (deleteFn) setDeleteThreadFn(() => deleteFn);
    },
    [setCopilotThreads, setActiveThreadId, setDeleteThreadFn]
  );

  const renderActivePillar = () => {
    switch (activePillar) {
      case "copilot-transmission":
        return (
          <CopilotPillar
            user={user}
            activeTab={
              activeTab === "library"
                ? "library"
                : activeTab === "validation"
                  ? "validation"
                  : "dashboard"
            }
            onPillarChange={handlePillarChange}
            onTabChange={handleTabChange}
            onLogout={handleLogout}
            onThreadsUpdate={handleThreadsUpdate}
            externalActiveThreadId={activeThreadId}
          />
        );
      case "detection-automation": {
        const automationTab = (
          ["overview","tasks","automations","analyze","library","settings","dashboard"] as const
        ).includes(activeTab as never)
          ? (activeTab as "overview" | "tasks" | "automations" | "analyze" | "library" | "settings" | "dashboard")
          : "dashboard" as const;
        return (
          <AutomationPillar
            user={user}
            activeTab={automationTab}
            onPillarChange={handlePillarChange}
            onTabChange={handleTabChange}
            onLogout={handleLogout}
          />
        );
      }
      case "decision-simulation": {
        const decisionTab = (
          ["dashboard","library","settings","tasks","automations","analyze","overview"] as const
        ).includes(activeTab as never)
          ? (activeTab as "dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview")
          : "dashboard" as const;
        return (
          <DecisionPillar
            user={user}
            activeTab={decisionTab}
            onPillarChange={handlePillarChange}
            onTabChange={(tab) => handleTabChange(tab as DashboardTab)}
            onLogout={handleLogout}
          />
        );
      }
      case "emotional-ai":
        return <EmotionalPillar />;
      case "client-synthesis":
        return (
          <ClientPillar
            user={user}
            activeTab={activeTab}
            onPillarChange={handlePillarChange}
            onTabChange={(tab) => handleTabChange(tab as DashboardTab)}
            onLogout={handleLogout}
          />
        );
      default:
        return (
          <CopilotPillar
            user={user}
            activeTab="dashboard"
            onPillarChange={handlePillarChange}
            onTabChange={handleTabChange}
            onLogout={handleLogout}
          />
        );
    }
  };

  const showGlobalDashboard =
    activeTab === "dashboard" &&
    activePillar !== "copilot-transmission" &&
    activePillar !== "decision-simulation" &&
    activePillar !== "detection-automation" &&
    activePillar !== "client-synthesis";

  const saasBrand = resolveSaasBrandFromModules(enabledModules);
  const isRegiairePrimary =
    getPrimaryBusinessModule(enabledModules) === ORG_MODULE_NAMES.REGIAIRE_CORE;

  if (activeTab === "settings") {
    return (
      <>
        <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20 flex-shrink-0">
          <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
            <span className="text-purple-500 border-b-2 border-purple-500 py-5">
              Configuration
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-4xl mx-auto py-10 text-white">
            <h1 className="text-4xl font-extrabold mb-12 text-white italic tracking-tighter uppercase">
              Réglages
            </h1>
            {isOrgRoleLoading ? null : isOrgAdmin ? (
              <OrganizationSettingsPanel />
            ) : (
              <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800/50">
                <p className="text-slate-400">
                  Accès réservé aux administrateurs de votre organisation.
                </p>
              </div>
            )}
          </div>
        </main>
      </>
    );
  }

  if (showGlobalDashboard) {
    return (
      <>
        <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20 flex-shrink-0">
          <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
            <span
              className={`border-b-2 py-5 ${
                isRegiairePrimary
                  ? "border-amber-500 text-amber-400"
                  : "border-purple-500 text-purple-500"
              }`}
            >
              {!isModulesLoading ? (
                <SaasBrandTitle brand={saasBrand} size="sm" />
              ) : (
                "…"
              )}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8 relative">
          <GlobalDashboard enabledModules={enabledModules} />
        </main>
      </>
    );
  }

  if (
    activePillar === "copilot-transmission" ||
    activePillar === "detection-automation" ||
    activePillar === "client-synthesis" ||
    activePillar === "decision-simulation"
  ) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {renderActivePillar()}
      </div>
    );
  }

  return (
    <>
      <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20 flex-shrink-0">
        <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
          <span className="text-purple-500 border-b-2 border-purple-500 py-5">
            {PILLARS.find((p) => p.id === activePillar)?.name || "OrbitAI"}
          </span>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">{renderActivePillar()}</div>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { type PillarId, PILLARS } from "@/features/pillars/types";
import { ContextualNavigation } from "@/features/pillars/components/ContextualNavigation";
import { GlobalDashboard } from "@/features/pillars/components/GlobalDashboard";
import { CopilotPillar } from "@/features/pillars/copilot-transmission/CopilotPillar";
import { AutomationPillar } from "@/features/pillars/detection-automation/AutomationPillar";
import { DecisionPillar } from "@/features/pillars/decision-simulation/DecisionPillar";
import { EmotionalPillar } from "@/features/pillars/emotional-ai/EmotionalPillar";
import { ClientPillar } from "@/features/pillars/client-synthesis/ClientPillar";

export default function OrbitDashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  // Initialiser avec un pilier qui affiche le dashboard global par défaut
  const [activePillar, setActivePillar] = useState<PillarId>("emotional-ai"); // Pilier désactivé = dashboard global
  const [activeTab, setActiveTab] = useState<"dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview" | "monitoring" | "validation">("dashboard");
  // État pour les threads de Copilot (pour la navigation contextuelle)
  const [copilotThreads, setCopilotThreads] = useState<Array<{ id_thread: string; title: string; created_at?: string }>>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [deleteThreadFn, setDeleteThreadFn] = useState<((threadId: string, e: React.MouseEvent) => Promise<void>) | null>(null);

  // Initialisation de la session
  useEffect(() => {
    const initSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setUser(session.user);
      }
    };
    initSession();
  }, [router, supabase]);

  // Redirection si pas de session
  if (!user) {
    return null;
  }

  // Fonction pour gérer le changement de pilier
  const handlePillarChange = (pillarId: PillarId) => {
    const pillar = PILLARS.find((p) => p.id === pillarId);
    if (pillar?.enabled) {
      setActivePillar(pillarId);
      // Réinitialiser l'onglet actif quand on change de pilier
      // Pour "detection-automation", le premier onglet est "overview"
      if (pillarId === "detection-automation") {
        setActiveTab("overview");
      } else {
        setActiveTab("dashboard");
      }
    }
  };

  // Fonction pour gérer le clic sur Dashboard
  const handleDashboardClick = () => {
    setActiveTab("dashboard");
    // Si on est sur un pilier avec son propre dashboard/vue d'ensemble, changer vers un pilier qui affiche le dashboard global
    if (activePillar === "copilot-transmission" || activePillar === "decision-simulation" || activePillar === "detection-automation" || activePillar === "client-synthesis") {
      // Changer vers le premier pilier qui n'a pas son propre dashboard
      const defaultPillar = PILLARS.find(
        (p) => p.id !== "copilot-transmission" && p.id !== "decision-simulation" && p.id !== "detection-automation" && p.id !== "client-synthesis"
      );
      if (defaultPillar) {
        setActivePillar(defaultPillar.id);
      }
    }
  };

  // Fonction de déconnexion
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Gestion des onglets système - Dashboard global ou Réglages
  if (activeTab === "settings") {
    return (
      <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans relative">
        <ContextualNavigation
          activePillar={activePillar}
          activeTab={activeTab}
          onPillarChange={handlePillarChange}
          onTabChange={setActiveTab}
          onLogout={handleLogout}
          userEmail={user.email}
          onDashboardClick={handleDashboardClick}
        />
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white">
          <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20">
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
              <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800/50">
                <p className="text-slate-400">Les paramètres seront disponibles prochainement.</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Dashboard global (quand on clique sur Dashboard dans le menu système et qu'on n'est pas sur un pilier avec son propre dashboard)
  const showGlobalDashboard = activeTab === "dashboard" && 
    activePillar !== "copilot-transmission" && 
    activePillar !== "decision-simulation" &&
    activePillar !== "detection-automation" &&
    activePillar !== "client-synthesis";

  if (showGlobalDashboard) {
    return (
      <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans relative">
        <ContextualNavigation
          activePillar={activePillar}
          activeTab={activeTab}
          onPillarChange={handlePillarChange}
          onTabChange={setActiveTab}
          onLogout={handleLogout}
          userEmail={user.email}
          onDashboardClick={handleDashboardClick}
        />
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white">
          <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20">
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
              <span className="text-purple-500 border-b-2 border-purple-500 py-5">
                Dashboard Global
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-8 relative">
            <GlobalDashboard />
          </main>
        </div>
      </div>
    );
  }

  // Rendu du pilier actif
  const renderActivePillar = () => {
    switch (activePillar) {
      case "copilot-transmission":
        return (
          <CopilotPillar
            user={user}
            activeTab={activeTab === "library" ? "library" : activeTab === "validation" ? "validation" : "dashboard"}
            onPillarChange={handlePillarChange}
            onTabChange={setActiveTab}
            onLogout={handleLogout}
            onThreadsUpdate={(threads, activeId, deleteFn) => {
              setCopilotThreads(threads);
              setActiveThreadId(activeId);
              if (deleteFn) {
                setDeleteThreadFn(() => deleteFn);
              }
            }}
            externalActiveThreadId={activeThreadId}
          />
        );
      case "detection-automation":
        return (
          <AutomationPillar
            user={user}
            activeTab={activeTab}
            onPillarChange={handlePillarChange}
            onTabChange={setActiveTab}
            onLogout={handleLogout}
          />
        );
      case "decision-simulation":
        return (
          <DecisionPillar
            user={user}
            activeTab={activeTab}
            onPillarChange={handlePillarChange}
            onTabChange={setActiveTab}
            onLogout={handleLogout}
          />
        );
      case "emotional-ai":
        return <EmotionalPillar />;
      case "client-synthesis":
        return (
          <ClientPillar
            user={user}
            activeTab={activeTab}
            onPillarChange={handlePillarChange}
            onTabChange={setActiveTab}
            onLogout={handleLogout}
          />
        );
      default:
        return (
          <CopilotPillar
            user={user}
            activeTab="dashboard"
            onPillarChange={handlePillarChange}
            onTabChange={setActiveTab}
            onLogout={handleLogout}
          />
        );
    }
  };

  // Handler pour cliquer sur un thread depuis la navigation
  const handleThreadClickFromNav = (threadId: string) => {
    setActiveThreadId(threadId);
    // S'assurer qu'on est sur l'onglet Discussions
    if (activeTab !== "dashboard") {
      setActiveTab("dashboard");
    }
  };

  // Handler pour supprimer un thread depuis la navigation
  const handleThreadDeleteFromNav = async (threadId: string, e: React.MouseEvent) => {
    // Mettre à jour l'état local
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
    }
    // Appeler la fonction de suppression
    if (deleteThreadFn) {
      await deleteThreadFn(threadId, e);
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans relative">
      <ContextualNavigation
        activePillar={activePillar}
        activeTab={activeTab}
        onPillarChange={handlePillarChange}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        userEmail={user.email}
        threads={activePillar === "copilot-transmission" ? copilotThreads : undefined}
        activeThreadId={activePillar === "copilot-transmission" ? activeThreadId : undefined}
        onThreadClick={activePillar === "copilot-transmission" ? handleThreadClickFromNav : undefined}
        onThreadDelete={activePillar === "copilot-transmission" ? handleThreadDeleteFromNav : undefined}
        onDashboardClick={handleDashboardClick}
      />
      {activePillar === "copilot-transmission" || activePillar === "detection-automation" || activePillar === "client-synthesis" || activePillar === "decision-simulation" ? (
        renderActivePillar()
      ) : (
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white">
          <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20">
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
              <span className="text-purple-500 border-b-2 border-purple-500 py-5">
                {PILLARS.find((p) => p.id === activePillar)?.name || "OrbitAI"}
              </span>
            </div>
          </header>
          {renderActivePillar()}
        </div>
      )}
    </div>
  );
}

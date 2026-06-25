// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { type PillarId, PILLARS } from "@/features/pillars/types";
import { ContextualNavigation } from "@/features/pillars/components/ContextualNavigation";
import { PasswordChangeGate } from "@/components/auth/PasswordChangeGate";
import {
  DashboardShellProvider,
  type DashboardTab,
} from "@/features/pillars/components/DashboardShellContext";
import { useOrganizationModules } from "@/hooks/useOrganizationModules";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [activePillar, setActivePillar] = useState<PillarId>("emotional-ai");
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");
  const [copilotThreads, setCopilotThreads] = useState<
    Array<{ id_thread: string; title: string; created_at?: string }>
  >([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [deleteThreadFn, setDeleteThreadFn] = useState<
    ((threadId: string, e: React.MouseEvent) => Promise<void>) | null
  >(null);
  const { enabledModules } = useOrganizationModules();

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

  if (!user) {
    return null;
  }

  const goHomeIfNeeded = () => {
    if (pathname !== "/") {
      router.push("/");
    }
  };

  const handlePillarChange = (pillarId: PillarId) => {
    const pillar = PILLARS.find((p) => p.id === pillarId);
    if (pillar?.enabled) {
      setActivePillar(pillarId);
      if (pillarId === "detection-automation") {
        setActiveTab("overview");
      } else {
        setActiveTab("dashboard");
      }
      goHomeIfNeeded();
    }
  };

  const handleDashboardClick = () => {
    setActiveTab("dashboard");
    if (
      activePillar === "copilot-transmission" ||
      activePillar === "decision-simulation" ||
      activePillar === "detection-automation" ||
      activePillar === "client-synthesis"
    ) {
      const defaultPillar = PILLARS.find(
        (p) =>
          p.id !== "copilot-transmission" &&
          p.id !== "decision-simulation" &&
          p.id !== "detection-automation" &&
          p.id !== "client-synthesis"
      );
      if (defaultPillar) {
        setActivePillar(defaultPillar.id);
      }
    }
    goHomeIfNeeded();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleThreadClickFromNav = (threadId: string) => {
    setActiveThreadId(threadId);
    if (activeTab !== "dashboard") {
      setActiveTab("dashboard");
    }
    goHomeIfNeeded();
  };

  const handleThreadDeleteFromNav = async (
    threadId: string,
    e: React.MouseEvent
  ) => {
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
    }
    if (deleteThreadFn) {
      await deleteThreadFn(threadId, e);
    }
  };

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    goHomeIfNeeded();
  };

  const contextValue = {
    user,
    activePillar,
    activeTab,
    setActivePillar,
    setActiveTab,
    handlePillarChange,
    handleTabChange,
    handleDashboardClick,
    handleLogout,
    copilotThreads,
    setCopilotThreads,
    activeThreadId,
    setActiveThreadId,
    setDeleteThreadFn,
  };

  return (
    <PasswordChangeGate>
      <DashboardShellProvider value={contextValue}>
        <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans relative">
          <ContextualNavigation
            activePillar={activePillar}
            activeTab={activeTab}
            onPillarChange={handlePillarChange}
            onTabChange={handleTabChange}
            onLogout={handleLogout}
            userEmail={user.email}
            threads={
              activePillar === "copilot-transmission" ? copilotThreads : undefined
            }
            activeThreadId={
              activePillar === "copilot-transmission" ? activeThreadId : undefined
            }
            onThreadClick={
              activePillar === "copilot-transmission"
                ? handleThreadClickFromNav
                : undefined
            }
            onThreadDelete={
              activePillar === "copilot-transmission"
                ? handleThreadDeleteFromNav
                : undefined
            }
            onDashboardClick={handleDashboardClick}
            enabledModules={enabledModules}
          />
          <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white overflow-hidden">
            {children}
          </div>
        </div>
      </DashboardShellProvider>
    </PasswordChangeGate>
  );
}

// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { createContext, useContext } from "react";
import type { PillarId } from "@/features/pillars/types";

export type DashboardTab =
  | "dashboard"
  | "library"
  | "settings"
  | "tasks"
  | "automations"
  | "analyze"
  | "overview"
  | "monitoring"
  | "validation";

export type DashboardShellContextValue = {
  user: { id: string; email?: string };
  activePillar: PillarId;
  activeTab: DashboardTab;
  setActivePillar: (pillar: PillarId) => void;
  setActiveTab: (tab: DashboardTab) => void;
  handlePillarChange: (pillarId: PillarId) => void;
  handleTabChange: (tab: DashboardTab) => void;
  handleDashboardClick: () => void;
  handleLogout: () => void;
  copilotThreads: Array<{ id_thread: string; title: string; created_at?: string }>;
  setCopilotThreads: React.Dispatch<
    React.SetStateAction<
      Array<{ id_thread: string; title: string; created_at?: string }>
    >
  >;
  activeThreadId: string | null;
  setActiveThreadId: React.Dispatch<React.SetStateAction<string | null>>;
  setDeleteThreadFn: React.Dispatch<
    React.SetStateAction<
      ((threadId: string, e: React.MouseEvent) => Promise<void>) | null
    >
  >;
};

const DashboardShellContext = createContext<DashboardShellContextValue | null>(
  null
);

export function DashboardShellProvider({
  value,
  children,
}: {
  value: DashboardShellContextValue;
  children: React.ReactNode;
}) {
  return (
    <DashboardShellContext.Provider value={value}>
      {children}
    </DashboardShellContext.Provider>
  );
}

export function useDashboardShell(): DashboardShellContextValue {
  const ctx = useContext(DashboardShellContext);
  if (!ctx) {
    throw new Error("useDashboardShell must be used within DashboardShell");
  }
  return ctx;
}

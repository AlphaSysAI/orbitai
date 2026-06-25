// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { type PillarId, PILLARS } from "../types";
import { useClientSynthesis } from "./hooks/useClientSynthesis";
import { ClientDashboard } from "./components/ClientDashboard";

interface ReviewSyncState {
  connected: boolean;
  placeName: string | null;
  lastSyncAt: string | null;
  newReviewsCount: number;
  totalReviewsSynced: number;
}

interface ClientPillarProps {
  user: { id: string; email?: string };
  activeTab?: string;
  onPillarChange?: (pillarId: PillarId) => void;
  onTabChange?: (tab: string) => void;
  onLogout?: () => void;
}

export function ClientPillar({ user }: ClientPillarProps) {
  const {
    feedbackItems,
    analyses,
    activeAnalysis,
    isLoading,
    runAnalysis,
    loadAnalysis,
    deleteAnalysis,
    deleteAllAnalyses,
  } = useClientSynthesis(user.id);

  const [reviewSync, setReviewSync] = useState<ReviewSyncState>({
    connected: false,
    placeName: null,
    lastSyncAt: null,
    newReviewsCount: 0,
    totalReviewsSynced: 0,
  });

  const fetchReviewSync = useCallback(async () => {
    try {
      const res = await fetch("/api/user/review-settings");
      if (res.ok) {
        const data = await res.json() as ReviewSyncState;
        setReviewSync(data);
      }
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    void fetchReviewSync();
  }, [fetchReviewSync]);

  const handleDismissNotifications = async () => {
    await fetch("/api/user/review-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    setReviewSync((prev) => ({ ...prev, newReviewsCount: 0 }));
  };

  const pillarConfig = PILLARS.find((p) => p.id === "client-synthesis");

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white">
      <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center px-8 z-20">
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] italic ${pillarConfig?.color ?? "text-emerald-400"}`}>
          {pillarConfig?.name ?? "Synthèse Intelligente Client"}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        <ClientDashboard
          feedbackItems={feedbackItems}
          analyses={analyses}
          activeAnalysis={activeAnalysis}
          isLoading={isLoading}
          onRunAnalysis={runAnalysis}
          onLoadAnalysis={loadAnalysis}
          onDeleteAnalysis={async (id) => { await deleteAnalysis(id); }}
          onDeleteAllAnalyses={async () => { await deleteAllAnalyses(); }}
          reviewSyncConnected={reviewSync.connected}
          placeName={reviewSync.placeName}
          lastSyncAt={reviewSync.lastSyncAt}
          newReviewsCount={reviewSync.newReviewsCount}
          totalReviewsSynced={reviewSync.totalReviewsSynced}
          onDismissNotifications={handleDismissNotifications}
        />
      </main>
    </div>
  );
}

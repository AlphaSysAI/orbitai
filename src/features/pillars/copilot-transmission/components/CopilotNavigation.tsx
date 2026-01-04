"use client";

import { MessageSquare, Trash2, Plus, LayoutDashboard, FileText, Settings, Orbit, LogOut } from "lucide-react";
import { PILLARS, type PillarId } from "../../types";
import * as Icons from "lucide-react";

interface Thread {
  id_thread: string;
  title: string;
}

interface CopilotNavigationProps {
  threads: Thread[];
  activeThreadId: string | null;
  activePillar: PillarId;
  activeTab: "dashboard" | "library" | "settings";
  onThreadClick: (threadId: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string, e: React.MouseEvent) => void;
  onPillarChange: (pillarId: PillarId) => void;
  onTabChange: (tab: "dashboard" | "library" | "settings") => void;
  onLogout: () => void;
  userEmail?: string;
}

export function CopilotNavigation({
  threads,
  activeThreadId,
  activePillar,
  activeTab,
  onThreadClick,
  onCreateThread,
  onDeleteThread,
  onPillarChange,
  onTabChange,
  onLogout,
  userEmail,
}: CopilotNavigationProps) {
  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.LayoutDashboard;
    return <IconComponent size={18} />;
  };

  return (
    <aside className="w-72 h-screen border-r border-slate-800 bg-[#0f172a] flex flex-col z-30 shadow-2xl text-white overflow-hidden">
      {/* Logo */}
      <div
        className="flex items-center gap-3 p-5 border-b border-slate-800 cursor-pointer flex-shrink-0 hover:bg-slate-900/50 transition"
        onClick={() => {
          onTabChange("dashboard");
        }}
      >
        <div className="bg-purple-600 p-2 rounded-lg">
          <Orbit size={20} className="text-white" />
        </div>
        <h2 className="text-xl font-bold tracking-tighter text-white uppercase italic">
          OrbitAI
        </h2>
      </div>

      {/* Piliers en haut - 2 lignes (3 + 2 centrés) */}
      <div className="border-b border-slate-800 bg-slate-900/30 p-3 flex-shrink-0">
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 px-2">
          Piliers
        </p>
        <div className="space-y-2">
          {/* Première ligne : 3 premiers piliers */}
          <div className="flex gap-2">
            {PILLARS.slice(0, 3).map((pillar) => {
              const Icon = (Icons as any)[pillar.icon] || Icons.LayoutDashboard;
              const isActive = activePillar === pillar.id;
              return (
                <button
                  key={pillar.id}
                  onClick={() => pillar.enabled && onPillarChange(pillar.id)}
                  disabled={!pillar.enabled}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                    isActive && pillar.enabled
                      ? "bg-purple-600/20 border-2 border-purple-500/40"
                      : pillar.enabled
                        ? "bg-slate-800/50 hover:bg-slate-800 border-2 border-transparent"
                        : "bg-slate-800/30 opacity-40 cursor-not-allowed border-2 border-transparent"
                  }`}
                >
                  <Icon size={20} className={isActive ? pillar.color : "text-slate-500"} />
                  <span className={`text-[9px] font-bold text-center leading-tight ${
                    isActive ? "text-white" : "text-slate-400"
                  }`}>
                    {pillar.name.split(' ')[0]}
                  </span>
                  {!pillar.enabled && (
                    <span className="text-[7px] text-slate-600">Bientôt</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Deuxième ligne : 2 derniers piliers centrés */}
          <div className="flex gap-2 justify-center">
            {PILLARS.slice(3).map((pillar) => {
              const Icon = (Icons as any)[pillar.icon] || Icons.LayoutDashboard;
              const isActive = activePillar === pillar.id;
              return (
                <button
                  key={pillar.id}
                  onClick={() => pillar.enabled && onPillarChange(pillar.id)}
                  disabled={!pillar.enabled}
                  className={`flex-1 max-w-[150px] flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                    isActive && pillar.enabled
                      ? "bg-purple-600/20 border-2 border-purple-500/40"
                      : pillar.enabled
                        ? "bg-slate-800/50 hover:bg-slate-800 border-2 border-transparent"
                        : "bg-slate-800/30 opacity-40 cursor-not-allowed border-2 border-transparent"
                  }`}
                >
                  <Icon size={20} className={isActive ? pillar.color : "text-slate-500"} />
                  <span className={`text-[9px] font-bold text-center leading-tight ${
                    isActive ? "text-white" : "text-slate-400"
                  }`}>
                    {pillar.name.split(' ')[0]}
                  </span>
                  {!pillar.enabled && (
                    <span className="text-[7px] text-slate-600">Bientôt</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation contextuelle - Discussions et Archives pour Copilot */}
      <div className="border-b border-slate-800 bg-slate-900/20 p-3 flex-shrink-0">
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 px-2">
          Navigation
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onTabChange("dashboard")}
            className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl transition-all ${
              activeTab === "dashboard"
                ? "bg-purple-600/20 border border-purple-500/40 text-purple-400"
                : "bg-slate-800/50 border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <MessageSquare size={18} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Discussions</span>
          </button>
          <button
            onClick={() => onTabChange("library")}
            className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl transition-all ${
              activeTab === "library"
                ? "bg-purple-600/20 border border-purple-500/40 text-purple-400"
                : "bg-slate-800/50 border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <FileText size={18} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Archives</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-5 overflow-hidden">

        {/* Bouton Nouveau Thread */}
        <button
          onClick={onCreateThread}
          className="w-full mb-6 flex items-center justify-center gap-2 p-3.5 bg-slate-800 hover:bg-purple-600 rounded-2xl transition-all border border-slate-700 group shadow-lg text-white font-black text-[10px] uppercase tracking-widest flex-shrink-0"
        >
          <Plus size={16} /> Nouveau Flux
        </button>

        {/* Liste des threads - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-2 scrollbar-hide mb-4">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-2 italic sticky top-0 bg-[#0f172a] z-10 pb-2">
          Intelligence History
        </p>
        {threads.map((t) => (
          <div
            key={t.id_thread}
            onClick={() => onThreadClick(t.id_thread)}
            className={`group flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all ${
              activeThreadId === t.id_thread
                ? "bg-purple-600/20 border border-purple-500/40 text-white"
                : "hover:bg-white/5 text-slate-400"
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <MessageSquare size={14} />
              <span className="text-[11px] font-bold truncate">{t.title}</span>
            </div>
            <button
              onClick={(e) => onDeleteThread(t.id_thread, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

        {/* Menu système (Dashboard/Réglages) */}
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 flex-shrink-0">
          <button
            onClick={() => onTabChange("dashboard")}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left ${
              activeTab === "dashboard" && activePillar !== "copilot-transmission"
                ? "bg-purple-600/15 text-purple-400"
                : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard size={18} />
            <span className="font-black text-[10px] uppercase tracking-widest">Dashboard</span>
          </button>
          <button
            onClick={() => onTabChange("settings")}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left ${
              activeTab === "settings"
                ? "bg-purple-600/15 text-purple-400"
                : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
            }`}
          >
            <Settings size={18} />
            <span className="font-black text-[10px] uppercase tracking-widest">Réglages</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 flex-shrink-0">
          {userEmail && (
            <div className="px-4 py-2 text-[10px] text-slate-400">
              <p className="font-bold text-white">{userEmail.split("@")[0]}</p>
              <p className="text-[8px] text-purple-500 uppercase mt-1 tracking-widest">Operator</p>
            </div>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-slate-500 hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            <LogOut size={18} />
            <span className="font-black text-[10px] uppercase tracking-widest">Déconnexion</span>
          </button>
        </div>
      </div>
    </aside>
  );
}


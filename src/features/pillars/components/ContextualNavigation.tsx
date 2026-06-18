"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Settings, Orbit, LogOut, ChevronDown, ChevronUp,
  FileText, Brain, MessageSquare, Archive, X, Sparkles, ListChecks, Zap, CheckCircle2, Fuel, Shield
} from "lucide-react";
import { PILLARS, type PillarId } from "../types";
import {
  STATION_NAV_LINKS,
  filterNavLinksByModules,
} from "@/lib/organizations/navigation";
import { isModuleEnabled, type EnabledOrgModule } from "@/lib/organizations/types";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useOrgRole } from "@/features/organization/hooks/useOrgRole";
import * as Icons from "lucide-react";

interface Thread {
  id_thread: string;
  title: string;
  created_at?: string;
}

interface ContextualNavigationProps {
  activePillar: PillarId;
  activeTab: "dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview" | "monitoring" | "validation";
  onPillarChange: (pillarId: PillarId) => void;
  onTabChange: (tab: "dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview" | "monitoring" | "validation") => void;
  onLogout: () => void;
  userEmail?: string;
  // Props pour Copilot
  threads?: Thread[];
  activeThreadId?: string | null;
  onThreadClick?: (threadId: string) => void;
  onThreadDelete?: (threadId: string, e: React.MouseEvent) => void;
  // Prop pour gérer le clic sur Dashboard
  onDashboardClick?: () => void;
  /** Modules activés pour l'organisation (multi-tenant) */
  enabledModules?: EnabledOrgModule[];
}

export function ContextualNavigation({
  activePillar,
  activeTab,
  onPillarChange,
  onTabChange,
  onLogout,
  userEmail,
  threads = [],
  activeThreadId = null,
  onThreadClick,
  onThreadDelete,
  onDashboardClick,
  enabledModules = [],
}: ContextualNavigationProps) {
  const pathname = usePathname();
  const [isSystemMenuOpen, setIsSystemMenuOpen] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { isOrgAdmin } = useOrgRole();
  const activePillarConfig = PILLARS.find((p) => p.id === activePillar);
  const stationLinks = filterNavLinksByModules(STATION_NAV_LINKS, enabledModules);
  const hasRegiaire = stationLinks.length > 0;

  const visiblePillars = PILLARS.filter((pillar) => {
    if (!pillar.enabled) return false;
    if (enabledModules.length === 0) return true;
    return isModuleEnabled(enabledModules, pillar.id);
  });

  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.LayoutDashboard;
    return <IconComponent size={18} />;
  };

  // Navigation spécifique par pilier
  const getPillarNavigation = () => {
    switch (activePillar) {
      case 'copilot-transmission':
        return [
          { id: 'discussions', label: 'Discussions', icon: <MessageSquare size={18} /> },
          { id: 'library', label: 'Archives', icon: <FileText size={18} /> },
          { id: 'validation', label: 'Révisions IA', icon: <CheckCircle2 size={18} /> },
        ];
      case 'decision-simulation':
        return [
          { id: 'dashboard', label: 'Simulation', icon: <Brain size={18} /> },
          { id: 'library', label: 'Archives', icon: <Archive size={18} /> },
        ];
      case 'detection-automation':
        return [
          { id: 'overview', label: 'Vue d\'ensemble', icon: <LayoutDashboard size={18} /> },
          { id: 'tasks', label: 'Tâches', icon: <ListChecks size={18} /> },
          { id: 'automations', label: 'Automatisations', icon: <Zap size={18} /> },
          { id: 'analyze', label: 'Analyse', icon: <Sparkles size={18} /> },
        ];
      case 'client-synthesis':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
          { id: 'library', label: 'Import', icon: <FileText size={18} /> },
          { id: 'monitoring', label: 'Surveillance', icon: <Zap size={18} /> },
          { id: 'analyze', label: 'Analyse', icon: <Sparkles size={18} /> },
        ];
      default:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        ];
    }
  };

  const pillarNav = getPillarNavigation();

  // Déterminer si on est sur le dashboard global (pas de navigation contextuelle)
  const isGlobalDashboard = activeTab === "dashboard" && 
    activePillar !== "copilot-transmission" && 
    activePillar !== "decision-simulation" &&
    activePillar !== "detection-automation" &&
    activePillar !== "client-synthesis";

  return (
    <aside className="w-72 border-r border-slate-800 bg-[#0f172a] flex flex-col z-30 shadow-2xl text-white overflow-hidden">
      {/* Logo en haut */}
      <div className="flex items-center gap-3 p-5 border-b border-slate-800">
        <div className="bg-purple-600 p-2 rounded-lg">
          <Orbit size={20} className="text-white" />
        </div>
        <h2 className="text-xl font-bold tracking-tighter text-white uppercase italic">
          OrbitAI
        </h2>
      </div>

      {/* Bouton Dashboard au-dessus des Piliers */}
      <div className="border-b border-slate-800 bg-slate-900/30 p-3 flex-shrink-0">
        <button
          onClick={() => {
            setIsSystemMenuOpen(false);
            if (onDashboardClick) {
              onDashboardClick();
            } else {
              onTabChange("dashboard");
            }
          }}
          className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all mb-3 ${
            activeTab === "dashboard" && activePillar !== "copilot-transmission" && activePillar !== "decision-simulation" && activePillar !== "client-synthesis"
              ? "bg-purple-600/20 border border-purple-500/40 text-purple-400"
              : "bg-slate-800/50 border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <LayoutDashboard size={18} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Dashboard</span>
        </button>
      </div>

      {/* Piliers en haut - 2 lignes (3 + 2 centrés) */}
      <div className="border-b border-slate-800 bg-slate-900/30 p-3 flex-shrink-0">
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 px-2">
          Piliers
        </p>
        <div className="space-y-2">
          {/* Première ligne : 3 premiers piliers */}
          <div className="flex gap-2">
            {visiblePillars.slice(0, 3).map((pillar) => {
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
            {visiblePillars.slice(3).map((pillar) => {
              const Icon = (Icons as any)[pillar.icon] || Icons.LayoutDashboard;
              const isActive = activePillar === pillar.id;
              return (
                <button
                  key={pillar.id}
                  onClick={() => pillar.enabled && onPillarChange(pillar.id)}
                  disabled={!pillar.enabled}
                  className={`w-[calc((100%-1rem)/3)] flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
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

      {/* RégiAire — liens filtrés par module org */}
      {hasRegiaire && (
        <div className="border-b border-slate-800 bg-slate-900/30 p-3 flex-shrink-0">
          <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 px-2 flex items-center gap-2">
            <Fuel size={10} className="text-amber-500" />
            RégiAire
          </p>
          <div className="flex flex-col gap-2">
            {stationLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                    isActive
                      ? "bg-amber-600/20 border border-amber-500/40 text-amber-400"
                      : "bg-slate-800/50 border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation contextuelle du pilier actif - Affichée juste sous les piliers (masquée sur dashboard global) */}
      {pillarNav.length > 0 && !isGlobalDashboard && (
        <div className="border-b border-slate-800 bg-slate-900/20 p-3 flex-shrink-0">
          <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 px-2">
            Navigation
          </p>
          <div className="flex flex-col gap-2">
            {pillarNav.map((nav) => (
              <button
                key={nav.id}
                onClick={() => {
                  // Pour "discussions", on map vers "dashboard" pour Copilot
                  let tabToSet: "dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview" | "monitoring" | "validation";
                  if (nav.id === 'discussions') {
                    tabToSet = 'dashboard';
                  } else if (nav.id === 'overview') {
                    tabToSet = 'overview';
                  } else {
                    tabToSet = nav.id as typeof tabToSet;
                  }
                  onTabChange(tabToSet);
                  setIsSystemMenuOpen(false);
                }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                    (nav.id === 'discussions' && activeTab === 'dashboard') || 
                    (nav.id === 'overview' && activeTab === 'overview') ||
                    (nav.id === 'validation' && activeTab === 'validation') ||
                    (activeTab === nav.id && nav.id !== 'discussions')
                      ? "bg-purple-600/20 border border-purple-500/40 text-purple-400"
                      : "bg-slate-800/50 border border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
              >
                {nav.icon}
                <span className="text-[9px] font-bold uppercase tracking-wider">{nav.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zone de contenu scrollable : historique des discussions pour Copilot */}
      {activePillar === 'copilot-transmission' && activeTab === 'dashboard' && threads.length > 0 && onThreadClick ? (
        <div className="flex-1 overflow-y-auto scrollbar-hide border-t border-slate-800">
          <div className="p-3">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 px-2">
              Historique
            </p>
            <div className="space-y-1">
              {threads.map((thread) => (
                <div
                  key={thread.id_thread}
                  className={`group w-full p-2.5 rounded-lg transition-all ${
                    activeThreadId === thread.id_thread
                      ? "bg-purple-600/20 border border-purple-500/40"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onThreadClick && onThreadClick(thread.id_thread)}
                      className="flex items-center gap-2 flex-1 text-left min-w-0"
                    >
                      <MessageSquare size={12} className={activeThreadId === thread.id_thread ? "text-purple-400" : "text-slate-400"} />
                      <span className={`text-[10px] font-medium truncate ${
                        activeThreadId === thread.id_thread ? "text-purple-400" : "text-slate-400"
                      }`}>
                        {thread.title}
                      </span>
                    </button>
                    {onThreadDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onThreadDelete(thread.id_thread, e);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-all flex-shrink-0"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-hide"></div>
      )}

      {/* Menu système (Dashboard/Réglages) */}
      <div className="border-t border-slate-800 p-5 space-y-2">
        <button
          onClick={() => setIsSystemMenuOpen(!isSystemMenuOpen)}
          className="w-full flex items-center justify-between p-4 rounded-2xl text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-all"
        >
          <div className="flex items-center gap-4">
            <Settings size={18} />
            <span className="font-black text-[10px] uppercase tracking-widest">Système</span>
          </div>
          {isSystemMenuOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isSystemMenuOpen && (
          <div className="space-y-1 pl-8 animate-in slide-in-from-top-2 duration-200">
            {isAdmin && (
              <Link
                href="/admin"
                className="w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left text-slate-500 hover:bg-white/5 hover:text-violet-400"
              >
                <Shield size={16} />
                <span className="font-black text-[10px] uppercase tracking-widest">Administration</span>
              </Link>
            )}
            {isOrgAdmin && (
              <button
                onClick={() => {
                  onTabChange("settings");
                  setIsSystemMenuOpen(false);
                }}
                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left ${
                  activeTab === "settings"
                    ? "bg-purple-600/15 text-purple-400"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Settings size={16} />
                <span className="font-black text-[10px] uppercase tracking-widest">Réglages</span>
              </button>
            )}
          </div>
        )}

        {/* Footer utilisateur */}
        <div className="pt-4 border-t border-slate-800 mt-4">
          {userEmail && (
            <div className="px-4 py-2 text-[10px] text-slate-400 mb-3">
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


"use client";

import { LayoutDashboard, FileText, Settings, Orbit, LogOut } from "lucide-react";
import { PILLARS, type PillarId } from "../types";
import * as Icons from "lucide-react";

interface PillarNavigationProps {
  activePillar: PillarId;
  activeTab: "dashboard" | "library" | "settings";
  onPillarChange: (pillarId: PillarId) => void;
  onTabChange: (tab: "dashboard" | "library" | "settings") => void;
  onLogout: () => void;
  userEmail?: string;
}

export function PillarNavigation({
  activePillar,
  activeTab,
  onPillarChange,
  onTabChange,
  onLogout,
  userEmail,
}: PillarNavigationProps) {
  const activePillarConfig = PILLARS.find((p) => p.id === activePillar);

  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.LayoutDashboard;
    return <IconComponent size={18} />;
  };

  return (
    <aside className="w-72 border-r border-slate-800 bg-[#0f172a] p-5 flex flex-col z-30 shadow-2xl text-white">
      <div
        className="flex items-center gap-3 mb-8 px-2 cursor-pointer"
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

      {/* Navigation principale */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-hide">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-2 italic">
          Navigation Principale
        </p>
        <NavItem
          icon={<LayoutDashboard size={18} />}
          label="Dashboard"
          active={activeTab === "dashboard"}
          onClick={() => onTabChange("dashboard")}
        />
        <NavItem
          icon={<FileText size={18} />}
          label="Bibliothèque"
          active={activeTab === "library"}
          onClick={() => onTabChange("library")}
        />
        <NavItem
          icon={<Settings size={18} />}
          label="Réglages"
          active={activeTab === "settings"}
          onClick={() => onTabChange("settings")}
        />
      </div>

      {/* Sélecteur de piliers */}
      <div className="mt-6 pt-6 border-t border-slate-800 space-y-2">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-2 italic">
          Piliers OrbitAI
        </p>
        {PILLARS.map((pillar) => {
          const Icon = (Icons as any)[pillar.icon] || Icons.LayoutDashboard;
          return (
            <button
              key={pillar.id}
              onClick={() => pillar.enabled && onPillarChange(pillar.id)}
              disabled={!pillar.enabled}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all text-left ${
                activePillar === pillar.id && pillar.enabled
                  ? "bg-purple-600/15 text-purple-400"
                  : pillar.enabled
                    ? "text-slate-500 hover:bg-white/5 hover:text-slate-200"
                    : "text-slate-600 opacity-50 cursor-not-allowed"
              }`}
            >
              <Icon size={18} className={pillar.color} />
              <div className="flex-1 min-w-0">
                <p className="font-black text-[10px] uppercase tracking-widest truncate">
                  {pillar.name}
                </p>
                {!pillar.enabled && (
                  <p className="text-[8px] text-slate-600 mt-1">Bientôt disponible</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-6 border-t border-slate-800 space-y-2">
        {userEmail && (
          <div className="px-4 py-2 text-[10px] text-slate-400">
            <p className="font-bold text-white">{userEmail.split("@")[0]}</p>
            <p className="text-[8px] text-purple-500 uppercase mt-1 tracking-widest">
              Operator
            </p>
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
    </aside>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${
        active ? "bg-purple-600/15 text-purple-400" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      {icon}
      <span className="font-black text-[10px] uppercase tracking-widest">{label}</span>
    </div>
  );
}






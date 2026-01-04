"use client";

import { Zap, Activity, Brain, Sparkles, Users, BarChart2, GraduationCap } from "lucide-react";
import { PILLARS } from "../types";
import * as Icons from "lucide-react";

export function GlobalDashboard() {
  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.LayoutDashboard;
    return <IconComponent size={24} />;
  };

  return (
    <div className="max-w-6xl mx-auto py-10 animate-in fade-in duration-700 text-white">
      <h1 className="text-4xl font-extrabold mb-12 text-white italic tracking-tighter uppercase">
        Dashboard OrbitAI
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {PILLARS.map((pillar) => {
          const Icon = (Icons as any)[pillar.icon] || Icons.LayoutDashboard;
          return (
            <div
              key={pillar.id}
              className={`bg-slate-900/40 p-8 rounded-[2rem] border transition-all group shadow-xl ${
                pillar.enabled
                  ? "border-slate-800/50 hover:border-slate-700"
                  : "border-slate-800/30 opacity-60"
              }`}
            >
              <div className={`flex items-center gap-4 mb-4 ${pillar.color}`}>
                <Icon size={24} />
                <p className="font-black text-[11px] uppercase tracking-widest text-white">
                  {pillar.name}
                </p>
              </div>
              <p className="text-slate-400 text-sm font-medium mb-3">{pillar.description}</p>
              <div className="flex items-center gap-2 mt-4">
                <span
                  className={`text-xs px-3 py-1 rounded-full ${
                    pillar.enabled
                      ? "bg-green-500/20 text-green-400"
                      : "bg-slate-700 text-slate-500"
                  }`}
                >
                  {pillar.enabled ? "Actif" : "Bientôt disponible"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800/50 hover:border-slate-700 transition-all group shadow-xl text-white">
          <div className="flex items-center gap-4 mb-4 text-yellow-400">
            <Zap size={24} />
            <p className="font-black text-[11px] uppercase tracking-widest text-white">Moteur IA</p>
          </div>
          <p className="text-slate-400 text-sm font-medium">GPT-4o Vision</p>
        </div>
        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800/50 hover:border-slate-700 transition-all group shadow-xl text-white">
          <div className="flex items-center gap-4 mb-4 text-green-400">
            <Activity size={24} />
            <p className="font-black text-[11px] uppercase tracking-widest text-white">Statut</p>
          </div>
          <p className="text-slate-400 text-sm font-medium">Système opérationnel</p>
        </div>
      </div>
    </div>
  );
}


"use client";

import { useState } from "react";
import { Plus, Trash2, Zap, Play, Pause, Archive } from "lucide-react";
import { Automation } from "../types";

interface AutomationListProps {
  automations: Automation[];
  activeAutomation: Automation | null;
  onAutomationSelect: (automationId: string) => void;
  onAutomationCreate: (automation: Partial<Automation>) => Promise<string | null>;
  onAutomationUpdate: (automationId: string, updates: Partial<Automation>) => Promise<boolean>;
  onAutomationDelete: (automationId: string) => Promise<boolean>;
  onToggleStatus: (automationId: string) => Promise<boolean>;
  isLoading: boolean;
}

export function AutomationList({
  automations,
  activeAutomation,
  onAutomationSelect,
  onAutomationCreate,
  onAutomationUpdate,
  onAutomationDelete,
  onToggleStatus,
  isLoading,
}: AutomationListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      default:
        return 'bg-slate-700/50 text-slate-400 border-slate-700';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'email':
        return 'Email';
      case 'file':
        return 'Fichier';
      case 'webhook':
        return 'Webhook';
      case 'internal':
        return 'Interne';
      default:
        return type;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-extrabold text-white italic tracking-tighter uppercase">
            Automatisations
          </h1>
          <button
            onClick={() => {
              // TODO: Ouvrir le modal de création
            }}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm transition"
          >
            <Plus size={16} />
            Nouvelle automatisation
          </button>
        </div>
      </div>

      {automations.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 p-12 rounded-2xl text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-slate-800/50 rounded-2xl">
              <Zap size={32} className="text-slate-500" />
            </div>
          </div>
          <p className="text-slate-400 text-lg font-medium mb-2">
            Aucune automatisation
          </p>
          <p className="text-slate-500 text-sm">
            Créez votre première automatisation pour automatiser vos tâches répétitives
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {automations.map((automation) => (
            <div
              key={automation.id}
              onClick={() => onAutomationSelect(automation.id)}
              className={`bg-slate-900/40 border p-6 rounded-2xl flex justify-between items-center group hover:bg-slate-900/80 transition-all cursor-pointer ${
                activeAutomation?.id === automation.id
                  ? 'border-violet-500/40 bg-violet-600/10'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className="p-3 bg-violet-600/10 rounded-xl flex-shrink-0">
                  <Zap size={20} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-white truncate">{automation.name}</p>
                    {automation.ai_suggested && (
                      <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">
                        IA
                      </span>
                    )}
                  </div>
                  {automation.description && (
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{automation.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(automation.status)}`}>
                      {automation.status}
                    </span>
                    <span className="text-xs text-slate-500">{getTypeLabel(automation.type)}</span>
                    <span className="text-xs text-slate-500">
                      {automation.execution_count} exécutions
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {automation.status === 'active' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStatus(automation.id);
                    }}
                    className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl hover:bg-yellow-500 hover:text-white transition-all"
                    title="Mettre en pause"
                  >
                    <Pause size={16} />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStatus(automation.id);
                    }}
                    className="p-3 bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500 hover:text-white transition-all"
                    title="Activer"
                  >
                    <Play size={16} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Supprimer cette automatisation ?")) {
                      onAutomationDelete(automation.id);
                    }
                  }}
                  className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



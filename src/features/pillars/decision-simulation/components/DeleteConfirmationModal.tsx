"use client";

import { AlertTriangle, X } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  simulationTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationModal({
  isOpen,
  simulationTitle,
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Confirmer la suppression</h3>
          <button
            onClick={onCancel}
            className="ml-auto p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-slate-300 mb-2">
            Êtes-vous sûr de vouloir supprimer cette simulation ?
          </p>
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-sm text-slate-400 font-medium">Simulation :</p>
            <p className="text-white font-semibold truncate mt-1">{simulationTitle}</p>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Cette action est irréversible. Tous les scénarios et conversations associés seront également supprimés.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-semibold transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-semibold transition"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}


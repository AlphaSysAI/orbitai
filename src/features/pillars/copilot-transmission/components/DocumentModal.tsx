// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { X, Plus, FileText, Zap } from "lucide-react";

interface PendingFile {
  name: string;
  text: string;
}

interface DocumentModalProps {
  isOpen: boolean;
  pendingFiles: PendingFile[];
  selectedFileIndex: number;
  modalMode: "upload" | "archive";
  onClose: () => void;
  onFileSelect: (index: number) => void;
  onRemoveFile: (index: number) => void;
  onAddMoreFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLaunchAnalysis: () => void;
}

export function DocumentModal({
  isOpen,
  pendingFiles,
  selectedFileIndex,
  modalMode,
  onClose,
  onFileSelect,
  onRemoveFile,
  onAddMoreFiles,
  onLaunchAnalysis,
}: DocumentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 text-white animate-in fade-in duration-300">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-5xl h-[85vh] rounded-[3rem] flex flex-col overflow-hidden shadow-2xl border-white/5 text-white">
        <div className="p-8 border-b border-slate-800/50 flex justify-between bg-white/[0.02] text-white">
          <div>
            <p className="font-black text-2xl uppercase tracking-tighter italic text-white">
              Centre de Préparation de Données
            </p>
            <p className="text-[10px] text-cyan-400 font-bold uppercase mt-1 tracking-widest italic">
              {pendingFiles.length} document(s) prêt(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-all hover:rotate-90"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden text-white">
          <div className="w-80 border-r border-slate-800/50 p-6 space-y-3 overflow-y-auto bg-black/20 text-white">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">
              Sources de l'analyse
            </p>
            {pendingFiles.map((file, idx) => (
              <div
                key={idx}
                onClick={() => onFileSelect(idx)}
                className={`group p-4 rounded-2xl cursor-pointer transition-all border flex items-center justify-between ${
                  selectedFileIndex === idx
                    ? "bg-cyan-600/20 border-cyan-500 text-white shadow-lg shadow-cyan-900/10"
                    : "bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden text-white">
                  <FileText
                    size={14}
                    className={selectedFileIndex === idx ? "text-cyan-400" : "text-slate-600"}
                  />
                  <span className="text-[11px] font-bold truncate">{file.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(idx);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-800 rounded-2xl cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-slate-500 hover:text-cyan-400 group text-white">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv"
                multiple
                onChange={onAddMoreFiles}
              />
              <Plus size={16} className="group-hover:rotate-90 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Ajouter</span>
            </label>
          </div>

          <div className="flex-1 p-10 overflow-y-auto bg-black/10 font-mono text-[13px] text-slate-400 leading-relaxed italic scrollbar-hide text-white">
            {pendingFiles[selectedFileIndex]?.text || "Aucune donnée sélectionnée."}
          </div>
        </div>

        <div className="p-8 border-t border-slate-800/50 flex gap-4 bg-white/[0.02] text-white">
          <button
            onClick={onClose}
            className="px-10 py-4 border border-slate-800 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all text-white"
          >
            Annuler
          </button>
          <button
            onClick={onLaunchAnalysis}
            className="flex-1 py-4 bg-cyan-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-cyan-500 transition-all text-white shadow-2xl shadow-cyan-600/40 flex items-center justify-center gap-3"
          >
            <Zap size={16} /> Lancer l'Analyse Croisée
          </button>
        </div>
      </div>
    </div>
  );
}


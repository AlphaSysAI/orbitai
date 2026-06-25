// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useState } from "react";
import { Brain, Trash2, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import type { DecisionSimulation } from "../types";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";

interface SimulationListProps {
  simulations: DecisionSimulation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function SimulationList({ simulations, activeId, onSelect, onDelete }: SimulationListProps) {
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; title: string } | null>(null);

  const handleDeleteClick = (sim: DecisionSimulation, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteCandidate({ id: sim.id, title: sim.title });
  };

  const handleConfirmDelete = () => {
    if (deleteCandidate) {
      const syntheticEvent = { stopPropagation: () => {} } as unknown as React.MouseEvent;
      onDelete(deleteCandidate.id, syntheticEvent);
      setDeleteCandidate(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteCandidate(null);
  };

  const generatePDF = (sim: DecisionSimulation) => {
    const doc = new jsPDF();
    let yPosition = 20;

    // En-tête
    doc.setFontSize(22);
    doc.setTextColor(147, 51, 234);
    doc.text("ORBITAI", 10, yPosition);
    yPosition += 10;

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text("Rapport Opérationnel - Simulation Décisionnelle", 10, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Simulation: ${sim.title}`, 10, yPosition);
    yPosition += 5;
    doc.text(`Date: ${new Date(sim.updatedAt).toLocaleDateString('fr-FR')}`, 10, yPosition);
    yPosition += 5;
    doc.text(`Statut: ${sim.status === 'ready' ? 'Prête' : sim.status === 'analyzing' ? 'En cours' : 'Conversation'}`, 10, yPosition);
    yPosition += 10;

    // Ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(10, yPosition, 200, yPosition);
    yPosition += 10;

    // Résumé exécutif
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text("RÉSUMÉ EXÉCUTIF", 10, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);

    // Extraire la question principale de la conversation
    const userMessages = sim.conversation.filter(m => m.role === 'user');
    const aiMessages = sim.conversation.filter(m => m.role === 'assistant');

    if (userMessages.length > 0) {
      const firstUserMessage = (userMessages[0]?.content ?? "").substring(0, 200);
      doc.text("Question/Décision: " + firstUserMessage, 10, yPosition);
      yPosition += 8;
    }

    // Contexte si disponible
    if (sim.context?.question) {
      doc.text("Contexte: " + sim.context.question.substring(0, 300), 10, yPosition);
      yPosition += 8;
    }

    if (aiMessages.length > 0) {
      const lastAiMessage = (aiMessages[aiMessages.length - 1]?.content ?? "");
      const plainText = lastAiMessage.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').substring(0, 400);
      const splitText = doc.splitTextToSize(plainText, 180);
      doc.text("Synthèse: " + splitText[0], 10, yPosition);
      yPosition += splitText.length > 1 ? 10 : 5;
    }

    yPosition += 5;

    // Scénarios avec métriques
    if (sim.scenarios.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text("SCÉNARIOS ANALYSÉS", 10, yPosition);
      yPosition += 10;

      sim.scenarios.forEach((scenario, index) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(`${index + 1}. ${scenario.title}`, 10, yPosition);
        yPosition += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        // Métriques clés
        const metrics: string[] = [];
        if (scenario.probability) metrics.push(`Probabilité: ${scenario.probability}%`);
        if (scenario.metrics.roi) metrics.push(`ROI: ${scenario.metrics.roi}%`);
        if (scenario.metrics.cost) metrics.push(`Coût: ${scenario.metrics.cost}`);
        if (scenario.metrics.duration) metrics.push(`Durée: ${scenario.metrics.duration} mois`);
        if (scenario.metrics.risk) metrics.push(`Risque: ${scenario.metrics.risk}/10`);
        if (scenario.metrics.impact) metrics.push(`Impact: ${scenario.metrics.impact}/10`);

        if (metrics.length > 0) {
          doc.setTextColor(80, 80, 80);
          doc.text(metrics.join(' | '), 10, yPosition);
          yPosition += 6;
        }

        // Description condensée
        doc.setTextColor(30, 41, 59);
        const desc = scenario.description.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').substring(0, 250);
        const splitDesc = doc.splitTextToSize(desc, 180);
        doc.text(splitDesc, 10, yPosition);
        yPosition += splitDesc.length * 4 + 5;

        // Recommandations si disponibles
        if (scenario.recommendations && scenario.recommendations.length > 0) {
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text("Recommandations:", 10, yPosition);
          yPosition += 5;
          scenario.recommendations.slice(0, 2).forEach((rec) => {
            doc.text(`• ${rec.substring(0, 100)}`, 12, yPosition);
            yPosition += 5;
          });
        }

        yPosition += 5;
      });
    } else {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Analyse en cours... Les scénarios seront disponibles une fois l'analyse terminée.", 10, yPosition);
      yPosition += 8;
    }

    // Recommandations globales
    if (sim.scenarios.length > 0 && sim.scenarios.some(s => s.recommendations && s.recommendations.length > 0)) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text("RECOMMANDATIONS STRATÉGIQUES", 10, yPosition);
      yPosition += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const allRecommendations = sim.scenarios
        .flatMap(s => s.recommendations || [])
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 5);

      allRecommendations.forEach((rec) => {
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`• ${rec}`, 10, yPosition);
        yPosition += 6;
      });
    }

    doc.save(`OrbitAI_Rapport_${sim.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`);
  };

  const handleExportClick = (sim: DecisionSimulation, e: React.MouseEvent) => {
    e.stopPropagation();
    generatePDF(sim);
  };
  return (
    <div className="max-w-4xl mx-auto py-10 animate-in fade-in duration-500 text-white">
      {simulations.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 p-12 rounded-[2rem] text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-slate-800/50 rounded-2xl">
              <Brain size={32} className="text-slate-500" />
            </div>
          </div>
          <p className="text-slate-400 text-lg font-medium mb-2">
            Aucune simulation dans les archives
          </p>
          <p className="text-slate-500 text-sm">
            Les simulations que vous créez seront disponibles ici
          </p>
        </div>
      ) : (
        <div className="grid gap-4 text-white">
          {simulations.map((sim) => (
            <div
              key={sim.id}
              onClick={() => onSelect(sim.id)}
              className={`bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] flex justify-between items-center group hover:bg-slate-900/80 transition-all cursor-pointer ${
                activeId === sim.id
                  ? 'bg-sky-600/20 border-sky-500/40'
                  : ''
              }`}
            >
              <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className="p-4 bg-sky-600/10 rounded-2xl text-sky-400 flex-shrink-0">
                  <Brain size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{sim.title}</p>
                  <p className="text-[9px] text-slate-500 uppercase mt-1 tracking-widest">
                    {new Date(sim.updatedAt).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[9px] px-2 py-1 rounded-full uppercase tracking-wider ${
                      sim.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                      sim.status === 'analyzing' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-700/50 text-slate-400'
                    }`}>
                      {sim.status === 'ready' ? 'Prête' : 
                       sim.status === 'analyzing' ? 'En cours' : 
                       'Conversation'}
                    </span>
                    {sim.scenarios.length > 0 && (
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">
                        {sim.scenarios.length} scénario{sim.scenarios.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {sim.status === 'ready' && sim.scenarios.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportClick(sim, e);
                    }}
                    className="p-3 hover:bg-purple-500/10 text-slate-500 hover:text-purple-400 rounded-xl transition-all"
                    title="Exporter en PDF"
                  >
                    <Download size={16} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(sim, e);
                  }}
                  className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={!!deleteCandidate}
        simulationTitle={deleteCandidate?.title || ""}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}


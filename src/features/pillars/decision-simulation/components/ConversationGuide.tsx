"use client";

import React, { useRef, useEffect, useState } from "react";
import { Send, Brain, Paperclip, FileText, X, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { jsPDF } from "jspdf";
import { ConversationMessage, Scenario } from "../types";

interface ConversationGuideProps {
  messages: ConversationMessage[];
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  status: 'conversation' | 'analyzing' | 'ready';
  uploadedDocuments?: Array<{ id: string; name: string; content: string }>;
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveDocument?: (id: string) => void;
  scenarios?: Scenario[];
  simulationTitle?: string;
}

export function ConversationGuide({ 
  messages, 
  isLoading, 
  onSendMessage, 
  status,
  uploadedDocuments = [],
  onFileUpload,
  onRemoveDocument,
  scenarios = [],
  simulationTitle = "Simulation Décisionnelle",
}: ConversationGuideProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Vérifier si on peut exporter (au moins 2 messages dont un de l'IA)
  const canExport = messages.length >= 2 && messages.some(m => m.role === 'assistant');

  const generatePDF = () => {
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
    doc.text(`Simulation: ${simulationTitle}`, 10, yPosition);
    yPosition += 5;
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 10, yPosition);
    yPosition += 10;

    // Ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(10, yPosition, 200, yPosition);
    yPosition += 10;

    // Résumé exécutif - extraire les points clés de la conversation
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.setFont(undefined, 'bold');
    doc.text("RÉSUMÉ EXÉCUTIF", 10, yPosition);
    yPosition += 8;

    // Extraire les points clés des messages de l'IA
    const aiMessages = messages.filter(m => m.role === 'assistant');
    const userMessages = messages.filter(m => m.role === 'user');
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    
    if (userMessages.length > 0) {
      const firstUserMessage = userMessages[0].content.substring(0, 200);
      doc.text("Question/Décision: " + firstUserMessage, 10, yPosition);
      yPosition += 8;
    }

    if (aiMessages.length > 0) {
      const lastAiMessage = aiMessages[aiMessages.length - 1].content;
      const plainText = lastAiMessage.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').substring(0, 400);
      const splitText = doc.splitTextToSize(plainText, 180);
      doc.text("Synthèse: " + splitText[0], 10, yPosition);
      yPosition += splitText.length > 1 ? 10 : 5;
    }
    
    yPosition += 5;

    // Scénarios avec métriques
    if (scenarios.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.setFont(undefined, 'bold');
      doc.text("SCÉNARIOS ANALYSÉS", 10, yPosition);
      yPosition += 10;

      scenarios.forEach((scenario, index) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(`${index + 1}. ${scenario.title}`, 10, yPosition);
        yPosition += 7;

        doc.setFont(undefined, 'normal');
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
      // Si pas de scénarios, indiquer que l'analyse est en cours
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Analyse en cours... Les scénarios seront disponibles une fois l'analyse terminée.", 10, yPosition);
      yPosition += 8;
    }

    // Recommandations globales
    if (scenarios.length > 0 && scenarios.some(s => s.recommendations && s.recommendations.length > 0)) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.setFont(undefined, 'bold');
      doc.text("RECOMMANDATIONS STRATÉGIQUES", 10, yPosition);
      yPosition += 10;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      
      // Regrouper les recommandations de tous les scénarios
      const allRecommendations = scenarios
        .flatMap(s => s.recommendations || [])
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 5); // Limiter à 5 recommandations principales

      allRecommendations.forEach((rec) => {
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(`• ${rec}`, 10, yPosition);
        yPosition += 6;
      });
    }

    doc.save(`OrbitAI_Rapport_${simulationTitle.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
        <div className="p-2 bg-sky-600/20 rounded-lg">
          <Brain size={20} className="text-sky-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Assistant Décisionnel</h3>
          <p className="text-xs text-slate-400">
            {status === 'conversation' && "Explorons ensemble votre situation..."}
            {status === 'analyzing' && "Analyse en cours..."}
            {status === 'ready' && "Simulation prête"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                msg.role === 'user' ? 'text-blue-400' : 'text-sky-400'
              }`}>
                {msg.role === 'user' ? 'Vous' : 'OrbitAI'}
              </span>
            </div>
            <div
              className={`max-w-[85%] rounded-2xl p-4 ${
                msg.role === 'user'
                  ? 'bg-blue-600/20 border border-blue-500/30 text-white rounded-tr-none'
                  : 'bg-slate-800/50 border border-slate-700/50 text-slate-100 rounded-tl-none'
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs">OrbitAI réfléchit...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Documents uploadés */}
      {uploadedDocuments.length > 0 && (
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/30">
          <p className="text-xs font-semibold text-slate-400 mb-2 uppercase">Documents attachés</p>
          <div className="flex flex-wrap gap-2">
            {uploadedDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700"
              >
                <FileText size={14} className="text-sky-400" />
                <span className="text-xs text-slate-300 truncate max-w-[200px]">{doc.name}</span>
                {onRemoveDocument && (
                  <button
                    onClick={() => onRemoveDocument(doc.id)}
                    className="p-1 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      {status === 'conversation' && (
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 bg-slate-900/30">
          <div className="flex gap-3">
            {onFileUpload && (
              <label className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer transition-all flex-shrink-0">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  multiple
                  onChange={onFileUpload}
                />
                <Paperclip size={20} className="text-slate-400" />
              </label>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Répondez aux questions ou décrivez votre situation..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-sky-600/50 resize-none min-h-[60px] max-h-[200px] scrollbar-hide"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-sky-600 p-3 rounded-xl hover:bg-sky-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            L'assistant posera des questions pour comprendre votre contexte. Vous pouvez aussi joindre des documents PDF pour enrichir l'analyse.
          </p>
        </form>
      )}

      {/* Bouton flottant d'export PDF */}
      {canExport && (
        <button
          onClick={generatePDF}
          className="absolute bottom-4 right-4 bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-full shadow-lg transition-all hover:scale-110 z-50"
          title="Exporter le rapport en PDF"
        >
          <Download size={20} />
        </button>
      )}
    </div>
  );
}


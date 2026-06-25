// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import React, { useRef, useEffect, useState } from "react";
import { Send, Download, Paperclip, Plus, ThumbsUp, ThumbsDown, Edit, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { jsPDF } from "jspdf";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNewConversation?: () => void;
  onGenerateGuide?: () => void;
  userId?: string | null;
  threadId?: string | null;
}

export function ChatInterface({
  messages,
  input,
  isLoading,
  onInputChange,
  onSubmit,
  onFileUpload,
  onNewConversation,
  onGenerateGuide,
  userId,
  threadId,
}: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generatePDF = (title: string, content: string) => {
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(content, 180);
    doc.setFontSize(22);
    doc.setTextColor(147, 51, 234);
    doc.text("ORBITAI", 10, 20);
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(splitText, 10, 40);
    doc.save(`OrbitAI_${Date.now()}.pdf`);
  };

  const downloadLatestAnalysis = () => {
    const lastAiMessage = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastAiMessage) {
      generatePDF("Rapport OrbitAI", lastAiMessage.content);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-600/20 rounded-lg">
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_green]" />
          </div>
          <div>
            <h3 className="font-bold text-white">Orbit Core</h3>
            <p className="text-xs text-slate-400">
              Copilote IA &amp; Transmission de savoir
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onGenerateGuide && messages.length === 0 && (
            <button
              onClick={onGenerateGuide}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-lg text-emerald-400 text-xs font-bold uppercase tracking-wider transition-all"
              title="Génère un guide d'onboarding condensé basé sur tous les documents uploadés"
            >
              <Plus size={14} />
              Guide d'onboarding
            </button>
          )}
          {onNewConversation && messages.length > 0 && (
            <button
              onClick={onNewConversation}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 rounded-lg text-cyan-400 text-xs font-bold uppercase tracking-wider transition-all"
            >
              <Plus size={14} />
              Nouvelle analyse
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onExport={() => generatePDF("OrbitAI Report", msg.content)}
            userId={userId}
            threadId={threadId}
          />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs">OrbitAI réfléchit...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer avec actions */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/30 flex flex-col gap-4">
        {messages.some((m) => m.role === "assistant") && (
          <button
            onClick={downloadLatestAnalysis}
            className="flex items-center justify-center gap-3 w-full py-3 bg-white/5 border border-white/10 hover:bg-cyan-600/20 hover:border-cyan-500/50 rounded-xl transition-all group"
          >
            <Download size={16} className="text-slate-500 group-hover:text-cyan-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-white">
              Générer Rapport Global
            </span>
          </button>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(input);
          }}
          className="flex gap-3 items-end"
        >
          <label className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer transition-all flex-shrink-0">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv"
              multiple
              onChange={onFileUpload}
            />
            <Paperclip size={20} className="text-slate-400" />
          </label>
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(input);
              }
            }}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-600/50 resize-none min-h-[60px] max-h-[200px] scrollbar-hide"
            placeholder="Posez une question sur vos documents uploadés..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-cyan-600 p-3 rounded-xl hover:bg-cyan-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  onExport,
  userId,
  threadId,
}: {
  message: Message;
  onExport: () => void;
  userId?: string | null;
  threadId?: string | null;
}) {
  const isUser = message.role === "user";
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const handleFeedback = async (type: 'positive' | 'negative') => {
    if (!userId || isUser || !message.id) return;
    
    setIsSubmittingFeedback(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          messageId: message.id,
          threadId,
          feedbackType: type,
          messageContent: message.content,
          userContext: {
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (response.ok) {
        setFeedbackGiven(type);
      }
    } catch (error) {
      console.error("Erreur envoi feedback:", error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleCorrection = async () => {
    if (!userId || isUser || !message.id || !correctionText.trim()) return;
    
    setIsSubmittingFeedback(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          messageId: message.id,
          threadId,
          feedbackType: 'correction',
          correctionText: correctionText.trim(),
          messageContent: message.content,
          userContext: {
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (response.ok) {
        setShowCorrection(false);
        setCorrectionText("");
        setFeedbackGiven('positive'); // Une correction est considérée comme un feedback positif après envoi
      }
    } catch (error) {
      console.error("Erreur envoi correction:", error);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div
      className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-in slide-in-from-bottom-2 duration-300 text-white`}
    >
      <div className="flex items-center gap-3 mb-2 px-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 italic text-white">
        <span className={isUser ? "text-blue-500" : "text-cyan-400"}>
          {isUser ? "Operator" : "OrbitAI Core"}
        </span>
        {!isUser && (
          <button
            onClick={onExport}
            className="hover:text-cyan-400 transition-all"
            title="Télécharger en PDF"
          >
            <Download size={11} />
          </button>
        )}
      </div>
      <div
        className={`p-5 rounded-[1.6rem] max-w-[90%] text-[13.5px] leading-relaxed shadow-xl ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-none shadow-blue-900/20"
            : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50"
        }`}
      >
        <div className="prose prose-invert prose-sm max-w-none text-white">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        
        {/* Boutons de feedback pour les messages de l'IA */}
        {!isUser && userId && (
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-2 flex-wrap">
            {!showCorrection ? (
              <>
                <button
                  onClick={() => handleFeedback('positive')}
                  disabled={isSubmittingFeedback || feedbackGiven === 'positive'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                    feedbackGiven === 'positive'
                      ? 'bg-green-600/30 text-green-400 border border-green-500/50'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-green-600/20 hover:text-green-400 border border-slate-600/50'
                  } disabled:opacity-50`}
                  title="Cette réponse est utile"
                >
                  <ThumbsUp size={14} />
                  Utile
                </button>
                <button
                  onClick={() => handleFeedback('negative')}
                  disabled={isSubmittingFeedback || feedbackGiven === 'negative'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                    feedbackGiven === 'negative'
                      ? 'bg-red-600/30 text-red-400 border border-red-500/50'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-red-600/20 hover:text-red-400 border border-slate-600/50'
                  } disabled:opacity-50`}
                  title="Cette réponse n'est pas utile"
                >
                  <ThumbsDown size={14} />
                  Pas utile
                </button>
                <button
                  onClick={() => setShowCorrection(true)}
                  disabled={isSubmittingFeedback}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-700/50 text-slate-400 hover:bg-cyan-600/20 hover:text-cyan-400 border border-slate-600/50 transition-all disabled:opacity-50"
                  title="Corriger ou améliorer cette réponse"
                >
                  <Edit size={14} />
                  Corriger
                </button>
              </>
            ) : (
              <div className="w-full space-y-2">
                <textarea
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  placeholder="Comment cette réponse devrait-elle être améliorée ?"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none min-h-[80px] focus:outline-none focus:border-cyan-500/50"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCorrection}
                    disabled={!correctionText.trim() || isSubmittingFeedback}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Envoyer la correction
                  </button>
                  <button
                    onClick={() => {
                      setShowCorrection(false);
                      setCorrectionText("");
                    }}
                    disabled={isSubmittingFeedback}
                    className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-400 rounded-lg text-xs transition-all disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


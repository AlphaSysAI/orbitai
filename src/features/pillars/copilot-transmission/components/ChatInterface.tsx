"use client";

import React, { useRef, useEffect } from "react";
import { Send, Download, Paperclip, Plus } from "lucide-react";
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
}

export function ChatInterface({
  messages,
  input,
  isLoading,
  onInputChange,
  onSubmit,
  onFileUpload,
  onNewConversation,
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
      <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 rounded-lg">
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_green]" />
          </div>
          <div>
            <h3 className="font-bold text-white">Orbit Core</h3>
            <p className="text-xs text-slate-400">
              Assistant IA & Transmission
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onNewConversation && messages.length > 0 && (
            <button
              onClick={onNewConversation}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-lg text-purple-400 text-xs font-bold uppercase tracking-wider transition-all"
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
          />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            className="flex items-center justify-center gap-3 w-full py-3 bg-white/5 border border-white/10 hover:bg-purple-600/20 hover:border-purple-500/50 rounded-xl transition-all group"
          >
            <Download size={16} className="text-slate-500 group-hover:text-purple-400" />
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
              accept=".pdf"
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
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-600/50 resize-none min-h-[60px] max-h-[200px] scrollbar-hide"
            placeholder="Instruction..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-purple-600 p-3 rounded-xl hover:bg-purple-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
}: {
  message: Message;
  onExport: () => void;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-in slide-in-from-bottom-2 duration-300 text-white`}
    >
      <div className="flex items-center gap-3 mb-2 px-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 italic text-white">
        <span className={isUser ? "text-blue-500" : "text-purple-500"}>
          {isUser ? "Operator" : "OrbitAI Core"}
        </span>
        {!isUser && (
          <button
            onClick={onExport}
            className="hover:text-purple-400 transition-all"
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
      </div>
    </div>
  );
}


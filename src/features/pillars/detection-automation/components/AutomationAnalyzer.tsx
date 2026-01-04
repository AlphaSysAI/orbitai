"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { GrayTask, Automation, TriggerConfig, ActionConfig } from "../types";

interface AutomationAnalyzerProps {
  tasks: GrayTask[];
  automations: Automation[];
  onCreateAutomation: (automation: Partial<Automation>) => Promise<string | null>;
  onUpdateTask: (taskId: string, updates: Partial<GrayTask>) => Promise<boolean>;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AutomationAnalyzer({
  tasks,
  automations,
  onCreateAutomation,
  onUpdateTask,
}: AutomationAnalyzerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Tu es un expert en automatisation de tâches. Tu dois analyser les tâches grises proposées et suggérer des automatisations pertinentes. 
              Tu as accès à ${tasks.length} tâches détectées et ${automations.length} automatisations existantes.
              Sois créatif et propose des solutions concrètes d'automatisation.`,
            },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: input },
          ],
        }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessage.content += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...assistantMessage };
                  return updated;
                });
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-white italic tracking-tighter uppercase mb-2">
          Analyse IA
        </h1>
        <p className="text-slate-400">
          Analysez vos tâches et obtenez des suggestions d'automatisation intelligentes
        </p>
      </div>

      <div className="flex flex-col h-[600px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
          <div className="p-2 bg-violet-600/20 rounded-lg">
            <Sparkles size={20} className="text-violet-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Assistant Automatisation</h3>
            <p className="text-xs text-slate-400">
              Analysez vos tâches et obtenez des suggestions d'automatisation
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">
                Décrivez vos tâches répétitives ou demandez des suggestions d'automatisation
              </p>
              <div className="text-sm text-slate-500">
                <p className="mb-2">Exemples de questions :</p>
                <ul className="list-disc list-inside space-y-1 text-left max-w-md mx-auto">
                  <li>"Comment automatiser l'envoi de rapports hebdomadaires ?"</li>
                  <li>"Analyse mes tâches et propose des automatisations"</li>
                  <li>"Crée une automatisation pour trier mes emails"</li>
                </ul>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 ${
                  msg.role === 'user'
                    ? 'bg-violet-600/20 border border-violet-500/30 text-white rounded-tr-none'
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
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs">OrbitAI réfléchit...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800 bg-slate-900/30">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Décrivez vos besoins d'automatisation..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-600/50 resize-none min-h-[60px] max-h-[200px] scrollbar-hide"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-violet-600 p-3 rounded-xl hover:bg-violet-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


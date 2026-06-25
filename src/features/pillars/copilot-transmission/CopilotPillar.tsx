// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import React, { useState, useEffect } from "react";
import { LogOut, MessageSquare, FileText, Trash2 } from "lucide-react";
import { useCopilot } from "./hooks/useCopilot";
import { ChatInterface } from "./components/ChatInterface";
import { DocumentLibrary } from "./components/DocumentLibrary";
import { DocumentModal } from "./components/DocumentModal";
import { ValidationDashboard } from "@/components/ValidationDashboard";
import { type PillarId, PILLARS } from "../types";

interface CopilotPillarProps {
  user: { id: string; email?: string };
  activeTab: "dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview" | "validation";
  onPillarChange?: (pillarId: PillarId) => void;
  onTabChange?: (tab: "dashboard" | "library" | "settings" | "tasks" | "automations" | "analyze" | "overview" | "validation") => void;
  onLogout?: () => void;
  onThreadsUpdate?: (threads: Array<{ id_thread: string; title: string; created_at?: string }>, activeThreadId: string | null, deleteThreadFn?: (threadId: string, e: React.MouseEvent) => Promise<void>) => void;
  externalActiveThreadId?: string | null;
}

export function CopilotPillar({ 
  user, 
  activeTab, 
  onPillarChange,
  onTabChange,
  onLogout,
  onThreadsUpdate,
  externalActiveThreadId,
}: CopilotPillarProps) {
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    messages,
    documents,
    isLoading,
    createThread,
    deleteThread,
    deleteDocument,
    submitMessage,
    uploadDocument,
    fetchDocuments,
  } = useCopilot(user.id);

  // Transmettre les threads au parent pour la navigation contextuelle
  useEffect(() => {
    if (onThreadsUpdate) {
      onThreadsUpdate(threads, activeThreadId, handleDeleteThread);
    }
  }, [threads, activeThreadId, onThreadsUpdate]);

  // Gérer le changement de thread depuis la navigation externe
  useEffect(() => {
    if (externalActiveThreadId && externalActiveThreadId !== activeThreadId) {
      setActiveThreadId(externalActiveThreadId);
    }
  }, [externalActiveThreadId, activeThreadId]);

  const [localInput, setLocalInput] = useState("");
  const [archiveViewThreadId, setArchiveViewThreadId] = useState<string | null>(null);

  // Réinitialiser la vue archive uniquement quand on quitte l'onglet library
  useEffect(() => {
    if (activeTab !== "library" && archiveViewThreadId) {
      setArchiveViewThreadId(null);
    }
  }, [activeTab]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"upload" | "archive">("upload");
  const [pendingFiles, setPendingFiles] = useState<{ name: string; text: string }[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const handleThreadClick = (threadId: string) => {
    setActiveThreadId(threadId);
  };

  const handleCreateThread = async () => {
    const newThreadId = await createThread();
    if (newThreadId) {
      handleThreadClick(newThreadId);
    }
  };

  const handleNewConversation = async () => {
    // Créer une nouvelle conversation et l'ouvrir
    await handleCreateThread();
  };

  const handleGenerateOnboardingGuide = async () => {
    // Générer un guide d'onboarding condensé basé sur tous les documents
    if (documents.length === 0) {
      alert("Veuillez d'abord uploader des documents pour générer un guide d'onboarding.");
      return;
    }

    const guidePrompt = `Génère un guide d'onboarding complet et condensé pour une nouvelle recrue qui reprend ce poste.

Ce guide doit :
1. **Expliquer les fondements du poste** : rôle, responsabilités principales, objectifs clés
2. **Synthétiser les processus essentiels** : étapes clés, procédures importantes
3. **Identifier les points critiques** : éléments à maîtriser en priorité
4. **Structurer l'information** : organiser par thématiques ou par processus
5. **Être pédagogique** : adapté à quelqu'un qui découvre le poste
6. **Citer les sources** : indiquer de quels documents proviennent les informations

Format : Guide structuré avec sections claires, sous-titres, et points clés.

Base-toi sur TOUS les documents de la base de connaissances pour créer ce guide complet.`;

    // Créer un nouveau thread et envoyer le message
    const newThreadId = await createThread();
    if (newThreadId) {
      setActiveThreadId(newThreadId);
      // Attendre un peu que le thread soit bien créé avant d'envoyer le message
      setTimeout(() => {
        submitMessage(guidePrompt);
      }, 100);
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer la discussion ?")) return;
    await deleteThread(threadId);
  };

  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer ce document ?")) return;
    await deleteDocument(docId);
  };

  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPendingFiles = [...pendingFiles];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/extract", { method: "POST", body: formData });
        const data = await res.json();

        if (data.text) {
          const uploadedDoc = await uploadDocument(file, data.text);
          newPendingFiles.push({ name: file.name, text: data.text });

          // Détecter automatiquement les tâches grises dans le document
          if (uploadedDoc && user?.id) {
            try {
              await fetch("/api/detect-tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: data.text,
                  userId: user.id,
                  documentId: uploadedDoc.id,
                  source: "document",
                }),
              });
              // La détection se fait en arrière-plan, pas besoin d'attendre
            } catch (detectError) {
              console.error("Erreur détection tâches:", detectError);
              // Ne pas bloquer l'upload si la détection échoue
            }
          }
        }
      } catch (err) {
        console.error("Erreur extraction:", err);
      }
    }

    setPendingFiles(newPendingFiles);
    setModalMode("upload");
    setIsModalOpen(true);
    e.target.value = "";
  };

  const removeFileFromQueue = (index: number) => {
    const updated = pendingFiles.filter((_, i) => i !== index);
    setPendingFiles(updated);
    if (selectedFileIndex >= updated.length) {
      setSelectedFileIndex(Math.max(0, updated.length - 1));
    }
    if (updated.length === 0) {
      setIsModalOpen(false);
    }
  };

  const launchGlobalAnalysis = () => {
    const fullContext = pendingFiles
      .map((f) => `DOCUMENT: ${f.name}\nCONTENU: ${f.text}`)
      .join("\n\n---\n\n");
    const prompt = `### 📂 ANALYSE MULTI-SOURCES : ${pendingFiles.length} documents chargés\n\nEffectue une analyse croisée de ces documents. Identifie les points communs, les divergences et synthétise les informations clés.\n\nSOURCE DE DONNÉES :\n${fullContext.substring(0, 6000)}`;

    setIsModalOpen(false);
    setPendingFiles([]);
    submitMessage(prompt);
  };

  const handleDocumentSelect = (doc: { name: string; full_text: string }) => {
    setPendingFiles([{ name: doc.name, text: doc.full_text }]);
    setModalMode("archive");
    setIsModalOpen(true);
  };

  const pillarConfig = PILLARS.find((p) => p.id === "copilot-transmission");
  const pillarColor = pillarConfig?.color.replace('text-', '') || 'cyan-400';
  const pillarLabel = 'Knowledge Expert';

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white">
        <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
            <span className={`${pillarConfig?.color || 'text-cyan-400'} border-b-2 border-${pillarColor} py-5`}>
              {pillarConfig?.name || "Copilote IA & Transmission"}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 relative">
          {activeTab === "validation" && (
            <ValidationDashboard userId={user.id} />
          )}
          {activeTab === "dashboard" && (
            <div className="max-w-4xl mx-auto py-10">
              {/* Indicateur de base de connaissances */}
              {documents.length > 0 && (
                <div className="mb-6 p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-green-600/20 rounded-lg">
                    <FileText size={16} className="text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Base de connaissances active
                    </p>
                    <p className="text-xs text-slate-400">
                      {documents.length} document{documents.length > 1 ? 's' : ''} disponible{documents.length > 1 ? 's' : ''} • Posez une question pour rechercher dans vos documents
                    </p>
                  </div>
                </div>
              )}
              {documents.length === 0 && (
                <div className="mb-6 p-4 bg-amber-900/20 border border-amber-800/50 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-amber-600/20 rounded-lg">
                    <FileText size={16} className="text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Aucun document dans la base de connaissances
                    </p>
                    <p className="text-xs text-slate-400">
                      Uploadez des PDFs pour créer votre base de connaissances et permettre à l'IA de répondre à vos questions
                    </p>
                  </div>
                </div>
              )}
              <ChatInterface
                messages={messages}
                input={localInput}
                isLoading={isLoading}
                onInputChange={setLocalInput}
                onSubmit={submitMessage}
                onFileUpload={handleFilesUpload}
                onNewConversation={handleNewConversation}
                onGenerateGuide={handleGenerateOnboardingGuide}
                userId={user.id}
                threadId={activeThreadId || undefined}
              />
            </div>
          )}

          {activeTab === "library" && (
            archiveViewThreadId ? (
              // Vue détaillée : conversation + documents
              <div className="max-w-6xl mx-auto py-10">
                <button
                  onClick={() => setArchiveViewThreadId(null)}
                  className="mb-6 text-slate-400 hover:text-white transition flex items-center gap-2"
                >
                  ← Retour aux archives
                </button>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Conversation */}
                  <div className="lg:col-span-2">
                    <h2 className="text-2xl font-bold text-white mb-6">
                      {threads.find(t => t.id_thread === archiveViewThreadId)?.title || "Conversation"}
                    </h2>
                    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 max-h-[600px] overflow-y-auto">
                      {messages.length > 0 && archiveViewThreadId === activeThreadId ? (
                        // Utiliser les messages déjà chargés
                        messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                          >
                            <div
                              className={`inline-block p-4 rounded-xl max-w-[80%] ${
                                msg.role === 'user'
                                  ? 'bg-blue-600/20 border border-blue-500/30'
                                  : 'bg-slate-800/50 border border-slate-700/50'
                              }`}
                            >
                              <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-400 text-center py-8">Chargement de la conversation...</div>
                      )}
                    </div>
                  </div>
                  {/* Documents liés */}
                  <div>
                    <h3 className="text-xl font-bold text-white mb-4">Documents associés</h3>
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl flex items-center gap-3"
                        >
                          <FileText size={20} className="text-cyan-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm truncate">{doc.name}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                      {documents.length === 0 && (
                        <p className="text-slate-500 text-sm">Aucun document associé</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Archives : Documents uploadés uniquement
              <DocumentLibrary
                documents={documents}
                onDocumentSelect={handleDocumentSelect}
                onDocumentDelete={handleDeleteDocument}
              />
            )
          )}
        </main>
      </div>

      <DocumentModal
        isOpen={isModalOpen}
        pendingFiles={pendingFiles}
        selectedFileIndex={selectedFileIndex}
        modalMode={modalMode}
        onClose={() => {
          setIsModalOpen(false);
          setPendingFiles([]);
        }}
        onFileSelect={setSelectedFileIndex}
        onRemoveFile={removeFileFromQueue}
        onAddMoreFiles={handleFilesUpload}
        onLaunchAnalysis={launchGlobalAnalysis}
      />
    </>
  );
}


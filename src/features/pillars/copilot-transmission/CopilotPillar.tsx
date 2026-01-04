"use client";

import React, { useState, useEffect } from "react";
import { LogOut, MessageSquare, FileText, Trash2 } from "lucide-react";
import { useCopilot } from "./hooks/useCopilot";
import { ChatInterface } from "./components/ChatInterface";
import { DocumentLibrary } from "./components/DocumentLibrary";
import { DocumentModal } from "./components/DocumentModal";
import { type PillarId, PILLARS } from "../types";

interface CopilotPillarProps {
  user: { id: string; email?: string };
  activeTab: "dashboard" | "library";
  onPillarChange?: (pillarId: PillarId) => void;
  onTabChange?: (tab: "dashboard" | "library" | "settings") => void;
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
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/extract", { method: "POST", body: formData });
        const data = await res.json();

        if (data.text) {
          await uploadDocument(file, data.text);
          newPendingFiles.push({ name: file.name, text: data.text });
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

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white">
        <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20">
          <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
            <span className="text-purple-500 border-b-2 border-purple-500 py-5">
              {pillarConfig?.name || "Copilote IA & Transmission"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
              <span className="text-[10px] font-bold text-white leading-none">
                {user.email?.split("@")[0]}
              </span>
              <span className="text-[8px] font-black text-purple-500 uppercase mt-1 tracking-widest">
                Operator
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 relative">
          {activeTab === "dashboard" && (
            <div className="max-w-4xl mx-auto py-10">
              <ChatInterface
                messages={messages}
                input={localInput}
                isLoading={isLoading}
                onInputChange={setLocalInput}
                onSubmit={submitMessage}
                onFileUpload={handleFilesUpload}
                onNewConversation={handleNewConversation}
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
                          <FileText size={20} className="text-purple-400 flex-shrink-0" />
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


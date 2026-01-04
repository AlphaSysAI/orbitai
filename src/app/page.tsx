"use client";

import React, { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import {
  LayoutDashboard, MessageSquare, Activity, Users, Settings, Zap, Send, Orbit,
  Trash2, Maximize2, Minimize2, Download, X, Plus, FileText, Paperclip,
  ShieldCheck, CreditCard, User, LogOut, FileDown, Files
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { jsPDF } from "jspdf";

export default function OrbitDashboard() {
  const supabase = createClient();
  const router = useRouter();
  
  // --- NAVIGATION & UTILISATEUR ---
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library' | 'settings'>('dashboard');
  const [settingsTab, setSettingsTab] = useState<'profile' | 'security' | 'plan'>('profile');
  
  // --- MOTEUR DE CHAT ---
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const [localInput, setLocalInput] = useState("");
  const [isChatFullWidth, setIsChatFullWidth] = useState(false);
  const [isChangingThread, setIsChangingThread] = useState(false);
  const [chatWidth, setChatWidth] = useState(400);
  
  // --- GESTION MULTI-DOCUMENTS ---
  const [myDocuments, setMyDocuments] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'upload' | 'archive'>('upload'); 
  const [pendingFiles, setPendingFiles] = useState<{name: string, text: string}[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  
  const isResizing = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const { isLoading } = useChat({ api: "/api/chat" }) as any;

  // --- INITIALISATION ---
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push('/login');
      else setUser(session.user);
    };
    initSession();
  }, [router, supabase]);

  useEffect(() => {
    if (user) { fetchThreads(); fetchDocuments(); }
  }, [user]);

  useEffect(() => {
    if (activeThreadId) fetchMessages(activeThreadId);
    else setLocalMessages([]);
  }, [activeThreadId]);

  // --- LOGIQUE SUPABASE ---
  const fetchThreads = async () => {
    const { data } = await supabase.from('threads').select('*').order('created_at', { ascending: false });
    if (data) setThreads(data);
  };

  const fetchMessages = async (threadId: string) => {
    const { data } = await supabase.from('messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
    if (data) setLocalMessages(data);
  };

  const fetchDocuments = async () => {
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (data) setMyDocuments(data);
  };

  const handleThreadClick = (threadId: string) => {
    setIsChangingThread(true);
    setActiveThreadId(threadId);
    setIsChatFullWidth(true);
    setTimeout(() => setIsChangingThread(false), 50);
  };

  const createNewThread = async () => {
    if (!user) return;
    const { data } = await supabase.from('threads').insert([{ user_id: user.id, title: "Nouvelle discussion" }]).select();
    if (data) { setThreads([data[0], ...threads]); handleThreadClick(data[0].id_thread); }
  };

  const deleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer la discussion ?")) return;
    const { error } = await supabase.from('threads').delete().eq('id_thread', threadId);
    if (!error) { setThreads(prev => prev.filter(t => t.id_thread !== threadId)); if (activeThreadId === threadId) setActiveThreadId(null); }
  };

  const deleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer ce document ?")) return;
    const { error } = await supabase.from('documents').delete().eq('id', docId);
    if (!error) setMyDocuments(prev => prev.filter(d => d.id !== docId));
  };

  // --- UPLOAD MULTIPLE ---
  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPendingFiles = [...pendingFiles];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/extract', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.text) {
          const { data: nDoc } = await supabase.from('documents').insert([{ user_id: user.id, name: file.name, full_text: data.text }]).select();
          if (nDoc) setMyDocuments(prev => [nDoc[0], ...prev]);
          newPendingFiles.push({ name: file.name, text: data.text });
        }
      } catch (err) { console.error("Erreur extraction:", err); }
    }

    setPendingFiles(newPendingFiles);
    setModalMode('upload');
    setIsModalOpen(true);
    e.target.value = "";
  };

  const removeFileFromQueue = (index: number) => {
    const updated = pendingFiles.filter((_, i) => i !== index);
    setPendingFiles(updated);
    if (selectedFileIndex >= updated.length) setSelectedFileIndex(Math.max(0, updated.length - 1));
    if (updated.length === 0) setIsModalOpen(false);
  };

// --- MOTEUR IA AVEC TITRAGE AUTOMATIQUE ---
const submitMessage = async (text: string) => {
  if (!text.trim() || isLoading || !user) return;
  
  let currentTid = activeThreadId;
  const isFirstMessage = localMessages.length === 0;

  // 1. Création du Thread si inexistant
  if (!currentTid) {
      const { data } = await supabase.from('threads').insert([
          { user_id: user.id, title: "Nouvelle discussion..." }
      ]).select();
      if (data) { 
          currentTid = data[0].id_thread; 
          setActiveThreadId(currentTid); 
          setThreads([data[0], ...threads]); 
      }
  }

  // 2. Insertion du message utilisateur
  const { data: insertedMsg } = await supabase.from('messages').insert([
      { user_id: user.id, thread_id: currentTid, role: 'user', content: text }
  ]).select();
  
  const userMsg = insertedMsg ? insertedMsg[0] : { id: Date.now().toString(), role: "user", content: text };
  setLocalMessages(prev => [...prev, userMsg]);
  setLocalInput("");

  try {
    // 3. Appel API pour la réponse de l'IA
    const response = await fetch("/api/chat", { 
      method: "POST", 
      body: JSON.stringify({ messages: [...localMessages, userMsg] }) 
    });
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let assistantFullText = "";
    const tempAiId = "temp-" + Date.now();
    
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      assistantFullText += decoder.decode(value);
      setLocalMessages(prev => {
        const others = prev.filter(m => m.id !== tempAiId);
        return [...others, { id: tempAiId, role: "assistant", content: assistantFullText }];
      });
    }

    // 4. Sauvegarde du message de l'IA
    await supabase.from('messages').insert([
      { user_id: user.id, thread_id: currentTid, role: 'assistant', content: assistantFullText }
    ]);

    // 5. GÉNÉRATION AUTOMATIQUE DU TITRE (Si c'est le début)
    if (isFirstMessage && currentTid) {
      const titlePrompt = `Génère un titre très court (max 5 mots) pour cette discussion basée sur ce message : "${text.substring(0, 100)}"`;
      
      const titleRes = await fetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({ 
              messages: [{ role: 'user', content: titlePrompt }],
              stream: false // On veut une réponse directe, pas de stream ici
          })
      });
      
      const titleData = await titleRes.text(); // On récupère le texte brut
      const cleanTitle = titleData.replace(/"/g, '').trim();

      // Mise à jour en BDD et dans l'UI
      await supabase.from('threads').update({ title: cleanTitle }).eq('id_thread', currentTid);
      setThreads(prev => prev.map(t => t.id_thread === currentTid ? { ...t, title: cleanTitle } : t));
    }

  } catch (err) { 
      console.error("Erreur Chat/Titrage:", err); 
  }
};

  const launchGlobalAnalysis = () => {
    const fullContext = pendingFiles.map(f => `DOCUMENT: ${f.name}\nCONTENU: ${f.text}`).join("\n\n---\n\n");
    const prompt = `### 📂 ANALYSE MULTI-SOURCES : ${pendingFiles.length} documents chargés\n\nEffectue une analyse croisée de ces documents. Identifie les points communs, les divergences et synthétise les informations clés.\n\nSOURCE DE DONNÉES :\n${fullContext.substring(0, 6000)}`;
    
    setIsModalOpen(false);
    setPendingFiles([]); 
    submitMessage(prompt);
  };

  // --- EXPORTS & PDF ---
  const generatePDF = (title: string, content: string) => {
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(content, 180);
    doc.setFontSize(22); doc.setTextColor(147, 51, 234); doc.text("ORBITAI", 10, 20);
    doc.setFontSize(10); doc.setTextColor(30, 41, 59); doc.text(splitText, 10, 40);
    doc.save(`OrbitAI_${Date.now()}.pdf`);
  };

  const downloadLatestAnalysis = () => {
    const lastAiMessage = [...localMessages].reverse().find(m => m.role === 'assistant');
    if (lastAiMessage) {
        generatePDF("Rapport OrbitAI", lastAiMessage.content);
    }
  };

  // --- RESIZING ---
  const startResizing = (e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResizing);
  };
  const resize = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 300 && newWidth < 800) setChatWidth(newWidth);
  };
  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResizing);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans relative">
      
      {/* SIDEBAR GAUCHE */}
      <aside className="w-72 border-r border-slate-800 bg-[#0f172a] p-5 flex flex-col z-30 shadow-2xl text-white">
        <div className="flex items-center gap-3 mb-8 px-2 cursor-pointer" onClick={() => {setActiveTab('dashboard'); setIsChatFullWidth(false);}}>
          <div className="bg-purple-600 p-2 rounded-lg"><Orbit size={20} className="text-white" /></div>
          <h2 className="text-xl font-bold tracking-tighter text-white uppercase italic">OrbitAI</h2>
        </div>

        <button onClick={createNewThread} className="w-full mb-6 flex items-center justify-center gap-2 p-3.5 bg-slate-800 hover:bg-purple-600 rounded-2xl transition-all border border-slate-700 group shadow-lg text-white font-black text-[10px] uppercase tracking-widest">
          <Plus size={16} /> Nouveau Flux
        </button>

        <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-hide text-white">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-2 italic">Intelligence History</p>
          {threads.map(t => (
            <div key={t.id_thread} onClick={() => handleThreadClick(t.id_thread)} className={`group flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all ${activeThreadId === t.id_thread ? 'bg-purple-600/20 border border-purple-500/40 text-white' : 'hover:bg-white/5 text-slate-400'}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare size={14} />
                <span className="text-[11px] font-bold truncate">{t.title}</span>
              </div>
              <button onClick={(e) => deleteThread(t.id_thread, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800 space-y-2">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<FileText size={18} />} label="Bibliothèque" active={activeTab === 'library'} onClick={() => setActiveTab('library')} />
          <NavItem icon={<Settings size={18} />} label="Réglages" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </aside>

      {/* ZONE CENTRALE */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative text-white">
        <header className="h-16 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md flex items-center justify-between px-8 z-20">
            <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                <span className="text-purple-500 border-b-2 border-purple-500 py-5">Cognition Core</span>
                <span className="hover:text-slate-300 transition-colors cursor-pointer">Neural Analytics</span>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex flex-col items-end mr-2">
                    <span className="text-[10px] font-bold text-white leading-none">{user.email?.split('@')[0]}</span>
                    <span className="text-[8px] font-black text-purple-500 uppercase mt-1 tracking-widest">Operator</span>
                </div>
                <button onClick={() => { supabase.auth.signOut(); router.push('/login'); }} className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-lg transition-all"><LogOut size={18} /></button>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 relative">
          {activeTab === 'dashboard' && (
            <div className="max-w-4xl mx-auto py-10 animate-in fade-in duration-700 text-white">
                <h1 className="text-4xl font-extrabold mb-12 text-white italic tracking-tighter uppercase">Poste de Pilotage</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white text-white">
                    <Widget title="Moteur" description="GPT-4o Vision" icon={<Zap />} color="text-yellow-400" />
                    <Widget title="Statut" description="Prêt pour analyse" icon={<Activity />} color="text-green-400" />
                </div>
            </div>
          )}

          {activeTab === 'library' && (
            <div className="max-w-4xl mx-auto py-10 animate-in fade-in duration-500 text-white">
                <h1 className="text-4xl font-extrabold mb-10 text-white italic uppercase tracking-tighter">Archives</h1>
                <div className="grid gap-4 text-white">
                    {myDocuments.map(doc => (
                        <div key={doc.id} className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] flex justify-between items-center group hover:bg-slate-900/80 transition-all">
                            <div className="flex items-center gap-5 cursor-pointer" onClick={() => { setPendingFiles([{name: doc.name, text: doc.full_text}]); setModalMode('archive'); setIsModalOpen(true); }}>
                                <div className="p-4 bg-purple-600/10 rounded-2xl text-purple-400"><FileText size={20}/></div>
                                <div><p className="font-bold">{doc.name}</p><p className="text-[9px] text-slate-500 uppercase mt-1 tracking-widest">{new Date(doc.created_at).toLocaleDateString()}</p></div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id, e); }} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </main>
      </div>

      {/* CHAT SIDEBAR */}
      <aside ref={chatRef} style={{ width: isChatFullWidth ? 'calc(100vw - 288px)' : `${chatWidth}px`, position: isChatFullWidth ? 'absolute' : 'relative', right: 0, top: 0, height: '100%' }} className={`border-l border-slate-800 bg-[#0f172a]/95 backdrop-blur-3xl flex flex-col z-40 shadow-2xl transition-all duration-500 text-white`}>
        {!isChatFullWidth && <div onMouseDown={startResizing} className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-purple-500/50 z-50" />}
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center text-white text-white">
          <div className="flex items-center gap-3"><div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_green]" /><h3 className="font-black text-[10px] uppercase tracking-[0.4em] text-slate-400 italic">Orbit Core</h3></div>
          <button onClick={() => setIsChatFullWidth(!isChatFullWidth)} className="text-slate-500 hover:text-white">{isChatFullWidth ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-8 scrollbar-hide text-white text-white">
          {localMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} onExport={() => generatePDF("OrbitAI Report", msg.content)} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT ZONE AVEC BOUTON RAPPORT RÉINTÉGRÉ */}
        <div className="p-6 bg-slate-900/60 border-t border-slate-800 flex flex-col gap-4 text-white">
          
          {/* LE BOUTON REVENU ICI */}
          {localMessages.some(m => m.role === 'assistant') && (
            <button 
                onClick={downloadLatestAnalysis}
                className="flex items-center justify-center gap-3 w-full py-3 bg-white/5 border border-white/10 hover:bg-purple-600/20 hover:border-purple-500/50 rounded-xl transition-all group shadow-2xl"
            >
                <FileDown size={16} className="text-slate-500 group-hover:text-purple-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-white">Générer Rapport Global</span>
            </button>
          )}

          <form onSubmit={(e) => { e.preventDefault(); submitMessage(localInput); }} className="flex gap-3 items-end text-white">
            <label className="p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl cursor-pointer transition-all mb-1 group shadow-lg text-white">
                <input type="file" className="hidden" accept=".pdf" multiple onChange={handleFilesUpload} />
                <Paperclip size={20} className="text-slate-400 group-hover:text-purple-400" />
            </label>
            <textarea value={localInput} onChange={(e) => setLocalInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitMessage(localInput); } }} className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-purple-600/50 transition-all shadow-inner resize-none min-h-[56px] scrollbar-hide" placeholder="Instruction..." />
            <button type="submit" disabled={!localInput.trim()} className="bg-purple-600 p-4 rounded-2xl hover:bg-purple-500 text-white active:scale-95 transition-all mb-1"><Send size={20}/></button>
          </form>
        </div>
      </aside>

      {/* MODALE MULTI-SOURCES */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 text-white animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-slate-800 w-full max-w-5xl h-[85vh] rounded-[3rem] flex flex-col overflow-hidden shadow-2xl border-white/5 text-white text-white">
            
            <div className="p-8 border-b border-slate-800/50 flex justify-between bg-white/[0.02] text-white">
              <div><p className="font-black text-2xl uppercase tracking-tighter italic text-white">Centre de Préparation de Données</p><p className="text-[10px] text-purple-500 font-bold uppercase mt-1 tracking-widest italic">{pendingFiles.length} document(s) prêt(s)</p></div>
              <button onClick={() => {setIsModalOpen(false); setPendingFiles([]);}} className="text-slate-500 hover:text-white transition-all hover:rotate-90"><X size={24}/></button>
            </div>
            
            <div className="flex-1 flex overflow-hidden text-white">
                <div className="w-80 border-r border-slate-800/50 p-6 space-y-3 overflow-y-auto bg-black/20 text-white text-white">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Sources de l'analyse</p>
                    {pendingFiles.map((file, idx) => (
                        <div key={idx} onClick={() => setSelectedFileIndex(idx)} className={`group p-4 rounded-2xl cursor-pointer transition-all border flex items-center justify-between ${selectedFileIndex === idx ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-900/10' : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
                            <div className="flex items-center gap-3 overflow-hidden text-white">
                                <FileText size={14} className={selectedFileIndex === idx ? "text-purple-400" : "text-slate-600"} />
                                <span className="text-[11px] font-bold truncate">{file.name}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); removeFileFromQueue(idx); }} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"><X size={12}/></button>
                        </div>
                    ))}
                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-800 rounded-2xl cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-slate-500 hover:text-purple-400 group text-white">
                        <input type="file" className="hidden" accept=".pdf" multiple onChange={handleFilesUpload} />
                        <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Ajouter</span>
                    </label>
                </div>

                <div className="flex-1 p-10 overflow-y-auto bg-black/10 font-mono text-[13px] text-slate-400 leading-relaxed italic scrollbar-hide text-white">
                    {pendingFiles[selectedFileIndex]?.text || "Aucune donnée sélectionnée."}
                </div>
            </div>

            <div className="p-8 border-t border-slate-800/50 flex gap-4 bg-white/[0.02] text-white text-white">
                <button onClick={() => {setIsModalOpen(false); setPendingFiles([]);}} className="px-10 py-4 border border-slate-800 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all text-white">Annuler</button>
                <button onClick={launchGlobalAnalysis} className="flex-1 py-4 bg-purple-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-purple-500 transition-all text-white shadow-2xl shadow-purple-600/40 flex items-center justify-center gap-3">
                   <Zap size={16} /> Lancer l'Analyse Croisée
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SOUS-COMPOSANTS ---
function NavItem({ icon, label, active, onClick }: any) {
  return (
    <div onClick={onClick} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${active ? "bg-purple-600/15 text-purple-400" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}>
      {icon} <span className="font-black text-[10px] uppercase tracking-widest">{label}</span>
    </div>
  );
}

function Widget({ title, description, icon, color }: any) {
  return (
    <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800/50 hover:border-slate-700 transition-all group shadow-xl text-white">
      <div className={`flex items-center gap-4 mb-4 ${color}`}>{icon} <p className="font-black text-[11px] uppercase tracking-widest text-white">{title}</p></div>
      <p className="text-slate-400 text-sm font-medium">{description}</p>
    </div>
  );
}

function ChatMessage({ message, onExport }: any) {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-in slide-in-from-bottom-2 duration-300 text-white`}>
      <div className="flex items-center gap-3 mb-2 px-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 italic text-white">
        <span className={isUser ? "text-blue-500" : "text-purple-500"}>{isUser ? "Operator" : "OrbitAI Core"}</span>
        {!isUser && <button onClick={onExport} className="hover:text-purple-400 transition-all"><Download size={11}/></button>}
      </div>
      <div className={`p-5 rounded-[1.6rem] max-w-[90%] text-[13.5px] leading-relaxed shadow-xl ${isUser ? "bg-blue-600 text-white rounded-tr-none shadow-blue-900/20" : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50"}`}>
        <div className="prose prose-invert prose-sm max-w-none text-white">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
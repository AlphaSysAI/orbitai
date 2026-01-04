import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

interface Thread {
  id_thread: string;
  title: string;
  created_at?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Document {
  id: string;
  name: string;
  created_at: string;
  full_text: string;
}

export function useCopilot(userId: string | null) {
  const supabase = createClient();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchThreads();
      fetchDocuments();
    }
  }, [userId]);

  useEffect(() => {
    if (activeThreadId) {
      fetchMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId]);

  const fetchThreads = async () => {
    const { data } = await supabase
      .from("threads")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setThreads(data);
  };

  const fetchMessages = async (threadId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setDocuments(data);
  };

  const createThread = async (): Promise<string | null> => {
    if (!userId) return null;
    const { data } = await supabase
      .from("threads")
      .insert([{ user_id: userId, title: "Nouvelle discussion" }])
      .select();
    if (data) {
      setThreads([data[0], ...threads]);
      return data[0].id_thread;
    }
    return null;
  };

  const deleteThread = async (threadId: string) => {
    const { error } = await supabase.from("threads").delete().eq("id_thread", threadId);
    if (!error) {
      setThreads((prev) => prev.filter((t) => t.id_thread !== threadId));
      if (activeThreadId === threadId) setActiveThreadId(null);
    }
  };

  const deleteDocument = async (docId: string) => {
    const { error } = await supabase.from("documents").delete().eq("id", docId);
    if (!error) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    }
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading || !userId) return;

    setIsLoading(true);
    let currentTid = activeThreadId;
    const isFirstMessage = messages.length === 0;

    // Créer le thread si nécessaire
    if (!currentTid) {
      const newThreadId = await createThread();
      if (newThreadId) {
        currentTid = newThreadId;
        setActiveThreadId(currentTid);
      }
    }

    // Insérer le message utilisateur
    const { data: insertedMsg } = await supabase
      .from("messages")
      .insert([{ user_id: userId, thread_id: currentTid, role: "user", content: text }])
      .select();

    const userMsg = insertedMsg
      ? insertedMsg[0]
      : { id: Date.now().toString(), role: "user" as const, content: text };
    setMessages((prev) => [...prev, userMsg]);

    // Enregistrer l'action dans l'historique (pour détection de tâches grises)
    if (currentTid) {
      try {
        await supabase
          .from('user_actions')
          .insert({
            user_id: userId,
            action_type: 'message_sent',
            metadata: {
              thread_id: currentTid,
              message_length: text.length,
            },
          });
      } catch (err) {
        // Échec silencieux pour ne pas perturber le flux principal
      }
    }

    try {
      // Appel API pour la réponse de l'IA
      const response = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantFullText = "";
      const tempAiId = "temp-" + Date.now();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        assistantFullText += decoder.decode(value);
        setMessages((prev) => {
          const others = prev.filter((m) => m.id !== tempAiId);
          return [...others, { id: tempAiId, role: "assistant" as const, content: assistantFullText }];
        });
      }

      // Sauvegarder le message de l'IA
      await supabase
        .from("messages")
        .insert([
          { user_id: userId, thread_id: currentTid, role: "assistant", content: assistantFullText },
        ]);

      // Génération/mise à jour automatique du titre basé sur toute la conversation
      if (currentTid) {
        // Construire un résumé de la conversation pour générer le titre
        const allMessages = [...messages, userMsg, { id: tempAiId, role: "assistant" as const, content: assistantFullText }];
        const conversationSummary = allMessages
          .slice(-6) // Prendre les 6 derniers messages (3 échanges)
          .map(m => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content.substring(0, 200)}`)
          .join('\n\n');

        const titlePrompt = `Génère un titre très court et précis (max 6-8 mots) qui résume l'idée principale et le sujet global de cette conversation :

${conversationSummary}

Le titre doit être :
- Concis (maximum 6-8 mots)
- Descriptif du sujet principal
- En français
- Sans guillemets ni ponctuation superflue

Réponds UNIQUEMENT avec le titre, rien d'autre.`;

        // Générer le titre en arrière-plan (ne pas bloquer l'UI)
        (async () => {
          try {
            const titleRes = await fetch("/api/chat", {
              method: "POST",
              body: JSON.stringify({
                messages: [{ role: "user", content: titlePrompt }],
                stream: false,
              }),
            });

            const titleData = await titleRes.text();
            // Nettoyer le titre : enlever guillemets, espaces multiples, etc.
            const cleanTitle = titleData
              .replace(/^["']|["']$/g, "") // Enlever guillemets au début/fin
              .replace(/["']/g, "") // Enlever tous les guillemets
              .replace(/\n+/g, " ") // Remplacer retours à la ligne par espaces
              .trim()
              .substring(0, 60); // Limiter à 60 caractères

            if (cleanTitle && cleanTitle.length > 3) {
              await supabase.from("threads").update({ title: cleanTitle }).eq("id_thread", currentTid);
              setThreads((prev) =>
                prev.map((t) => (t.id_thread === currentTid ? { ...t, title: cleanTitle } : t))
              );
            }
          } catch (err) {
            console.error("Erreur génération titre:", err);
          }
        })();
      }
    } catch (err) {
      console.error("Erreur Chat/Titrage:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadDocument = async (file: File, text: string) => {
    if (!userId) return null;
    const { data } = await supabase
      .from("documents")
      .insert([{ user_id: userId, name: file.name, full_text: text }])
      .select();
    if (data) {
      setDocuments((prev) => [data[0], ...prev]);
      
      // Enregistrer l'action dans l'historique
      try {
        await supabase
          .from('user_actions')
          .insert({
            user_id: userId,
            action_type: 'document_upload',
            metadata: {
              document_id: data[0].id,
              document_name: file.name,
              document_size: text.length,
            },
          });
      } catch (err) {
        // Échec silencieux
        console.error("Erreur tracking action:", err);
      }
      
      return data[0];
    }
    return null;
  };

  return {
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
  };
}


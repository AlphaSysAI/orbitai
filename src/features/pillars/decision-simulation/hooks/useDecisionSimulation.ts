// Copyright © 2026 OrbitSys. Tous droits réservés.

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import type { DecisionSimulation, ConversationMessage, DecisionContext, Scenario } from "../types";

export function useDecisionSimulation(userId: string | null) {
  const supabase = createClient();
  
  const [simulations, setSimulations] = useState<DecisionSimulation[]>([]);
  const [activeSimulation, setActiveSimulation] = useState<DecisionSimulation | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentContext, setCurrentContext] = useState<DecisionContext>({});
  const [uploadedDocuments, setUploadedDocuments] = useState<Array<{ id: string; name: string; content: string }>>([]);
  const [isSaved, setIsSaved] = useState(false); // Flag pour savoir si la simulation est sauvegardée

  useEffect(() => {
    if (userId) {
      fetchSimulations();
    }
  }, [userId]);

  const fetchSimulations = async () => {
    // Note: Il faudra créer la table decision_simulations dans Supabase
    // Pour l'instant, on simule avec des données locales
    const { data, error } = await supabase
      .from('decision_simulations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setSimulations(data.map(transformDbToSimulation));
    }
  };

  const transformDbToSimulation = (dbRow: any): DecisionSimulation => ({
    id: dbRow.id,
    userId: dbRow.user_id,
    title: dbRow.title,
    status: dbRow.status,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
    context: dbRow.context || {},
    conversation: dbRow.conversation || [],
    scenarios: dbRow.scenarios || [],
    selectedScenarios: dbRow.selected_scenarios || [],
    notes: dbRow.notes,
    tags: dbRow.tags || [],
  });

  const createNewSimulation = async () => {
    if (!userId) return null;

    const newSim: DecisionSimulation = {
      id: Date.now().toString(),
      userId,
      title: "Nouvelle simulation",
      status: 'conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      context: {},
      conversation: [
        {
          id: '1',
          role: 'assistant',
          content: "Bonjour ! Je suis votre assistant en simulation décisionnelle. Pour vous aider à explorer les différents scénarios et prendre une décision éclairée, j'aimerais comprendre votre situation.\n\n**Quelle décision souhaitez-vous simuler aujourd'hui ?**\n\nDécrivez-moi votre question ou dilemme de manière aussi détaillée que possible.",
          timestamp: new Date(),
        }
      ],
      scenarios: [],
    };

    setActiveSimulation(newSim);
    setConversation(newSim.conversation);
    setCurrentContext({});
    setUploadedDocuments([]);
    setIsSaved(false); // Pas encore sauvegardée, le sera au premier message
    
    // Ne pas sauvegarder maintenant, seulement au premier message
    return newSim.id;
  };

  const saveSimulation = async (sim: DecisionSimulation) => {
    if (!userId) return;

    const dbRow = {
      id: sim.id,
      user_id: userId,
      title: sim.title,
      status: sim.status,
      created_at: sim.createdAt,
      updated_at: new Date().toISOString(),
      context: sim.context,
      conversation: sim.conversation,
      scenarios: sim.scenarios,
      selected_scenarios: sim.selectedScenarios || [],
      notes: sim.notes || null,
      tags: sim.tags || [],
    };

    const { error } = await supabase
      .from('decision_simulations')
      .upsert(dbRow, { onConflict: 'id' });

    if (!error) {
      await fetchSimulations();
    }
  };

  const sendMessage = async (content: string) => {
    if (!activeSimulation || isAnalyzing) return;

    // Si c'est le premier message et que la simulation n'est pas encore sauvegardée, la sauvegarder maintenant
    const isFirstMessage = conversation.length === 1; // Le premier message assistant existe déjà
    if (isFirstMessage && !isSaved) {
      await saveSimulation(activeSimulation);
      setIsSaved(true);
      // Rafraîchir la liste pour inclure la nouvelle simulation
      await fetchSimulations();
    }

    const userMessage: ConversationMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const updatedConversation = [...conversation, userMessage];
    setConversation(updatedConversation);

    // Mettre à jour le contexte avec les informations de l'utilisateur
    const updatedContext = extractContextFromMessage(content, currentContext);
    setCurrentContext(updatedContext);

    setIsAnalyzing(true);

    try {
      // Préparer le contexte avec les documents uploadés
      const contextWithDocuments = {
        ...updatedContext,
        documents: uploadedDocuments.map(d => ({
          id: d.id,
          name: d.name,
          content: d.content.substring(0, 5000), // Limiter pour éviter les tokens excessifs
        })),
      };

      // Appel à l'API pour que l'IA pose des questions ou génère les scénarios
      const response = await fetch('/api/decision-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: updatedConversation,
          context: contextWithDocuments,
          simulationId: activeSimulation.id,
        }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantFullText = '';
      const tempId = `temp-${Date.now()}`;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantFullText += decoder.decode(value);

        const assistantMessage: ConversationMessage = {
          id: tempId,
          role: 'assistant',
          content: assistantFullText,
          timestamp: new Date(),
        };

        setConversation([...updatedConversation, assistantMessage]);
      }

      // Sauvegarder la conversation mise à jour
      const finalConversation = [...updatedConversation, {
        id: tempId,
        role: 'assistant' as const,
        content: assistantFullText,
        timestamp: new Date(),
      }];

      // Mettre à jour la simulation avec la nouvelle conversation
      const updated: DecisionSimulation = {
        ...activeSimulation,
        context: updatedContext,
        conversation: finalConversation,
        updatedAt: new Date().toISOString(),
      };
      
      // Sauvegarder la simulation (elle est déjà sauvegardée si c'est après le premier message)
      await saveSimulation(updated);
      setActiveSimulation(updated);

      // Si l'IA indique que le contexte est suffisant, générer les scénarios
      if (shouldGenerateScenarios(assistantFullText)) {
        await generateScenarios(updatedContext, finalConversation);
      }

    } catch (error) {
      console.error('Erreur lors de la conversation:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const extractContextFromMessage = (message: string, current: DecisionContext): DecisionContext => {
    // Extraction basique - peut être améliorée avec du NLP
    const lower = message.toLowerCase();
    
    return {
      ...current,
      question: lower.includes('décision') ? message : current.question,
      decisionType: lower.includes('stratégique') ? 'strategic' : 
                    lower.includes('opérationnel') ? 'operational' : 
                    current.decisionType || 'both',
      documents: uploadedDocuments.length > 0 ? uploadedDocuments : current.documents,
    };
  };

  const uploadDocument = async (file: File): Promise<{ id: string; name: string; content: string } | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/extract', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.text) {
        const doc = {
          id: Date.now().toString(),
          name: file.name,
          content: data.text,
        };
        
        setUploadedDocuments(prev => [...prev, doc]);
        
        // Mettre à jour le contexte avec le nouveau document
        setCurrentContext(prev => ({
          ...prev,
          documents: [...(prev.documents || []), doc],
        }));

        return doc;
      }
    } catch (error) {
      console.error('Erreur upload document:', error);
    }
    return null;
  };

  const removeDocument = (id: string) => {
    setUploadedDocuments(prev => prev.filter(d => d.id !== id));
    setCurrentContext(prev => ({
      ...prev,
      documents: prev.documents?.filter(d => d.id !== id) || [],
    }));
  };

  const shouldGenerateScenarios = (assistantMessage: string): boolean => {
    // L'IA indique qu'elle a assez d'informations
    return assistantMessage.includes('scénarios') || 
           assistantMessage.includes('analyser') ||
           assistantMessage.toLowerCase().includes('générer');
  };

  const generateScenarios = async (context: DecisionContext, fullConversation: ConversationMessage[]) => {
    if (!activeSimulation) return;

    setIsAnalyzing(true);

    try {
      // Inclure les documents dans le contexte pour la génération
      const contextWithDocuments = {
        ...context,
        documents: uploadedDocuments.map(d => ({
          id: d.id,
          name: d.name,
          content: d.content.substring(0, 5000), // Limiter pour éviter les tokens excessifs
        })),
      };

      const response = await fetch('/api/decision-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: contextWithDocuments,
          conversation: fullConversation,
        }),
      });

      const data = await response.json();
      const scenarios: Scenario[] = data.scenarios || [];

      const updated: DecisionSimulation = {
        ...activeSimulation,
        status: 'ready',
        context,
        conversation: fullConversation,
        scenarios,
        updatedAt: new Date().toISOString(),
      };

      setActiveSimulation(updated);
      await saveSimulation(updated);

    } catch (error) {
      console.error('Erreur lors de la génération des scénarios:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteSimulation = async (id: string) => {
    const { error } = await supabase
      .from('decision_simulations')
      .delete()
      .eq('id', id);

    if (!error) {
      setSimulations(prev => prev.filter(s => s.id !== id));
      if (activeSimulation?.id === id) {
        setActiveSimulation(null);
        setConversation([]);
      }
    }
  };

  const loadSimulation = (id: string) => {
    const sim = simulations.find(s => s.id === id);
    if (sim) {
      setActiveSimulation(sim);
      setConversation(sim.conversation);
      setCurrentContext(sim.context);
      setUploadedDocuments((sim.context.documents ?? []).map((d) => ({ ...d, content: d.content ?? "" })));
      setIsSaved(true); // Les simulations chargées depuis la DB sont déjà sauvegardées
    }
  };

  return {
    simulations,
    activeSimulation,
    conversation,
    isAnalyzing,
    currentContext,
    uploadedDocuments,
    createNewSimulation,
    sendMessage,
    deleteSimulation,
    loadSimulation,
    saveSimulation,
    uploadDocument,
    removeDocument,
  };
}


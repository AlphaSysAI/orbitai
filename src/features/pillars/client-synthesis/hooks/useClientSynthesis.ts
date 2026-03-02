import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface FeedbackSource {
  id: string;
  source_type: string;
  source_name: string;
  total_items: number;
  last_sync_at?: string;
  is_active: boolean;
  monitoring_url?: string | null;
  auto_monitoring?: boolean;
  monitoring_frequency?: string;
}

export interface FeedbackItem {
  id: string;
  content: string;
  rating?: number | null; // Note/rating (1-5) pour les avis
  summary?: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  category: string;
  urgency: string;
  feedback_date: string;
}

export interface MarketingAnalysis {
  id: string;
  weaknesses: Array<{
    title: string;
    description: string;
    severity: string;
    impact: string;
    category: string;
    examples: string[];
    frequency: number;
  }>;
  strengths: Array<{
    title: string;
    description: string;
    category: string;
    examples: string[];
  }>;
  levers: Array<{
    title: string;
    description: string;
    type: string;
    priority: string;
    expected_impact: string;
    actions: string[];
    resources_needed?: string[];
  }>;
  opportunities: Array<{
    title: string;
    description: string;
    potential_value: string;
    category: string;
    recommended_actions: string[];
  }>;
  threats: Array<{
    title: string;
    description: string;
    urgency: string;
  }>;
  key_insights: Array<{
    insight: string;
    category: string;
    supporting_evidence: string[];
  }>;
  recommendations: Array<{
    recommendation: string;
    priority: string;
    category: string;
    expected_outcome: string;
  }>;
  trends: {
    sentiment_trend: string;
    top_themes: Array<{
      theme: string;
      frequency: number;
      sentiment: string;
    }>;
    emerging_concerns: string[];
  };
  overall_sentiment: number;
  satisfaction_score: number;
  nps_score: number;
  total_feedback_analyzed: number;
  positive_count: number;
  negative_count: number;
  created_at: string;
  status: string;
}

export function useClientSynthesis(userId: string | null) {
  const supabase = createClient();
  
  const [sources, setSources] = useState<FeedbackSource[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [analyses, setAnalyses] = useState<MarketingAnalysis[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<MarketingAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      console.log('🔄 [useClientSynthesis] Chargement des données pour userId:', userId);
      fetchSources();
      fetchAnalyses();
      fetchFeedback(); // Charger aussi les feedback items
    }
  }, [userId]);

  const fetchSources = async () => {
    if (!userId) {
      console.warn('⚠️ [fetchSources] userId manquant');
      return;
    }
    
    console.log('🔍 [fetchSources] Récupération des sources pour userId:', userId);
    
    const { data, error } = await supabase
      .from('client_feedback_sources')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ [fetchSources] Erreur:', error);
      return;
    }
    
    if (data) {
      console.log(`✅ [fetchSources] ${data.length} sources récupérées`);
      setSources(data as FeedbackSource[]);
    } else {
      console.warn('⚠️ [fetchSources] Aucune donnée retournée');
      setSources([]);
    }
  };

  const fetchAnalyses = async () => {
    if (!userId) {
      console.warn('⚠️ [fetchAnalyses] userId manquant');
      return;
    }
    
    console.log('🔍 [fetchAnalyses] Récupération des analyses pour userId:', userId);
    
    const { data, error } = await supabase
      .from('marketing_analysis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ [fetchAnalyses] Erreur:', error);
      return;
    }
    
    if (data) {
      console.log(`✅ [fetchAnalyses] ${data.length} analyses récupérées`);
      setAnalyses(data as MarketingAnalysis[]);
      if (data.length > 0 && !activeAnalysis) {
        setActiveAnalysis(data[0] as MarketingAnalysis);
      }
    } else {
      console.warn('⚠️ [fetchAnalyses] Aucune donnée retournée');
      setAnalyses([]);
    }
  };

  const fetchFeedback = async (sourceId?: string) => {
    if (!userId) {
      console.warn('⚠️ [fetchFeedback] userId manquant');
      return;
    }
    
    console.log('🔍 [fetchFeedback] Récupération des feedback items pour userId:', userId, sourceId ? `source: ${sourceId}` : 'toutes sources');
    
    let query = supabase
      .from('client_feedback_items')
      .select('*')
      .eq('user_id', userId)
      .order('feedback_date', { ascending: false })
      .limit(100);

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('❌ [fetchFeedback] Erreur:', error);
      return;
    }
    
    if (data) {
      console.log(`✅ [fetchFeedback] ${data.length} feedback items récupérés`);
      setFeedbackItems(data as FeedbackItem[]);
    } else {
      console.warn('⚠️ [fetchFeedback] Aucune donnée retournée');
      setFeedbackItems([]);
    }
  };

  const importFeedback = async (
    sourceType: string,
    sourceName: string,
    items: Array<{ content: string; date?: string; [key: string]: any }>
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/client-feedback/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sourceType,
          sourceName,
          items,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ [importFeedback] Erreur API:', data);
        const errorMsg = data.error || 'Erreur import';
        const debugInfo = data.debug ? `\n\nDebug: ${JSON.stringify(data.debug, null, 2)}` : '';
        throw new Error(`${errorMsg}${debugInfo}`);
      }
      
      if (data.success) {
        await fetchSources();
        await fetchFeedback();
        return data;
      }
      
      throw new Error(data.error || 'Erreur import');
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalysis = async (periodStart?: string, periodEnd?: string, sourceIds?: string[]) => {
    setIsLoading(true);
    try {
      console.log('🔍 [runAnalysis] Démarrage analyse:', { userId, periodStart, periodEnd, sourceIds });
      
      const response = await fetch('/api/client-feedback/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          periodStart,
          periodEnd,
          sourceIds,
        }),
      });

      const data = await response.json();
      console.log('📊 [runAnalysis] Réponse API:', { success: data.success, error: data.error });
      
      if (!response.ok) {
        console.error('❌ [runAnalysis] Erreur HTTP:', response.status, data);
        
        // Gestion spéciale des rate limits (429)
        if (response.status === 429 && data.retryAfter) {
          const error: any = new Error(data.error || 'Limite de requêtes atteinte');
          error.retryAfter = data.retryAfter;
          error.errorCode = data.errorCode;
          error.suggestion = data.suggestion;
          throw error;
        }
        
        throw new Error(data.error || `Erreur ${response.status}: ${response.statusText}`);
      }
      
      if (data.success) {
        console.log('✅ [runAnalysis] Analyse réussie, mise à jour des analyses...');
        await fetchAnalyses();
        if (data.analysis) {
          setActiveAnalysis(data.analysis);
          console.log('✅ [runAnalysis] Analyse active définie:', data.analysis.id);
        }
        return data.analysis;
      }
      
      throw new Error(data.error || 'Erreur analyse');
    } catch (error: any) {
      console.error('❌ [runAnalysis] Erreur:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalysis = (id: string) => {
    const analysis = analyses.find(a => a.id === id);
    if (analysis) {
      setActiveAnalysis(analysis);
    }
  };

  // Fonctions pour gérer les sources de surveillance
  const addMonitoringSource = async (config: {
    source_type: string;
    source_name: string;
    monitoring_url: string;
    auto_monitoring: boolean;
    monitoring_frequency: string;
  }) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_feedback_sources')
        .insert({
          user_id: userId,
          ...config,
          is_active: true,
        })
        .select()
        .single();

      if (!error && data) {
        await fetchSources();
        return data;
      }
      throw new Error(error?.message || 'Erreur lors de l\'ajout');
    } finally {
      setIsLoading(false);
    }
  };

  const updateMonitoringSource = async (id: string, updates: Partial<FeedbackSource>) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_feedback_sources')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (!error && data) {
        await fetchSources();
        return data;
      }
      throw new Error(error?.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMonitoringSource = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('client_feedback_sources')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (!error) {
        await fetchSources();
      } else {
        throw new Error(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFromMonitoringSource = async (sourceId: string) => {
    setIsLoading(true);
    try {
      // Récupérer les commentaires depuis la source de surveillance
      const response = await fetch('/api/client-feedback/fetch-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          userId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchSources();
        await fetchFeedback();
        return data;
      }
      throw new Error(data.error || 'Erreur lors de la récupération');
    } finally {
      setIsLoading(false);
    }
  };

  const testMonitoringConnection = async (sourceId: string, userIdForTest: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/client-feedback/fetch-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          userId: userIdForTest || userId,
        }),
      });

      const data = await response.json();
      // Retourner true même si fetched = 0, car la connexion fonctionne
      // Le message sera géré dans le composant
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  const deleteFeedbackSource = async (sourceId: string) => {
    setIsLoading(true);
    try {
      console.log('🗑️ [deleteFeedbackSource] Suppression de la source:', sourceId);
      
      // Supprimer tous les items de feedback associés à cette source
      const { error: itemsError } = await supabase
        .from('client_feedback_items')
        .delete()
        .eq('source_id', sourceId)
        .eq('user_id', userId);

      if (itemsError) {
        console.error('❌ [deleteFeedbackSource] Erreur suppression items:', itemsError);
        throw new Error(itemsError.message || 'Erreur lors de la suppression des retours');
      }

      // Supprimer la source elle-même
      const { error: sourceError } = await supabase
        .from('client_feedback_sources')
        .delete()
        .eq('id', sourceId)
        .eq('user_id', userId);

      if (sourceError) {
        console.error('❌ [deleteFeedbackSource] Erreur suppression source:', sourceError);
        throw new Error(sourceError.message || 'Erreur lors de la suppression de la source');
      }

      console.log('✅ [deleteFeedbackSource] Source supprimée avec succès');

      // Rafraîchir les données
      await fetchSources();
      await fetchFeedback();
      
      return true;
    } catch (error: any) {
      console.error('❌ [deleteFeedbackSource] Erreur:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAnalysis = async (analysisId: string) => {
    setIsLoading(true);
    try {
      console.log('🗑️ [deleteAnalysis] Suppression de l\'analyse:', analysisId);
      
      const { error } = await supabase
        .from('marketing_analysis')
        .delete()
        .eq('id', analysisId)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [deleteAnalysis] Erreur:', error);
        throw new Error(error.message || 'Erreur lors de la suppression de l\'analyse');
      }

      console.log('✅ [deleteAnalysis] Analyse supprimée avec succès');

      // Si l'analyse supprimée était l'analyse active, réinitialiser
      if (activeAnalysis?.id === analysisId) {
        setActiveAnalysis(null);
      }

      // Rafraîchir les analyses
      await fetchAnalyses();
      
      return true;
    } catch (error: any) {
      console.error('❌ [deleteAnalysis] Erreur:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAllAnalyses = async () => {
    setIsLoading(true);
    try {
      console.log('🗑️ [deleteAllAnalyses] Suppression de toutes les analyses pour userId:', userId);
      
      const { error } = await supabase
        .from('marketing_analysis')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [deleteAllAnalyses] Erreur:', error);
        throw new Error(error.message || 'Erreur lors de la suppression des analyses');
      }

      console.log('✅ [deleteAllAnalyses] Toutes les analyses supprimées avec succès');

      // Réinitialiser l'analyse active
      setActiveAnalysis(null);

      // Rafraîchir les analyses
      await fetchAnalyses();
      
      return true;
    } catch (error: any) {
      console.error('❌ [deleteAllAnalyses] Erreur:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sources,
    feedbackItems,
    analyses,
    activeAnalysis,
    isLoading,
    importFeedback,
    runAnalysis,
    loadAnalysis,
    fetchFeedback,
    fetchSources,
    refreshAnalyses: fetchAnalyses,
    // Surveillance automatique
    addMonitoringSource,
    updateMonitoringSource,
    deleteMonitoringSource,
    fetchFromMonitoringSource,
    testMonitoringConnection,
    // Gestion des sources manuelles
    deleteFeedbackSource,
    // Gestion des analyses
    deleteAnalysis,
    deleteAllAnalyses,
  };
}


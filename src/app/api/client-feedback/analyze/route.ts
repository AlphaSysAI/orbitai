import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Edge runtime désactivé car il peut causer des problèmes avec Supabase et les variables d'environnement
// export const runtime = 'edge';

// Schémas pour l'analyse structurée
const WeaknessSchema = z.object({
  title: z.string(),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  impact: z.string(),
  category: z.enum(['product', 'service', 'communication', 'pricing', 'experience', 'support', 'other']),
  examples: z.array(z.string()),
  frequency: z.number(), // Nombre de mentions
});

const LeverSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(['marketing', 'communication', 'product', 'service', 'pricing', 'experience']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  expected_impact: z.string(),
  actions: z.array(z.string()),
  // resources_needed retiré car optionnel et cause des problèmes avec generateObject
  // On peut l'ajouter dans actions si nécessaire
});

const OpportunitySchema = z.object({
  title: z.string(),
  description: z.string(),
  potential_value: z.string(),
  category: z.string(),
  recommended_actions: z.array(z.string()),
});

const AnalysisResultSchema = z.object({
  weaknesses: z.array(WeaknessSchema).min(0),
  strengths: z.array(z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    examples: z.array(z.string()),
  })).min(0),
  levers: z.array(LeverSchema).min(0),
  opportunities: z.array(OpportunitySchema).min(0),
  threats: z.array(z.object({
    title: z.string(),
    description: z.string(),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
  })).min(0),
  key_insights: z.array(z.object({
    insight: z.string(),
    category: z.string(),
    supporting_evidence: z.array(z.string()),
  })),
  recommendations: z.array(z.object({
    recommendation: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    category: z.string(),
    expected_outcome: z.string(),
  })),
  trends: z.object({
    sentiment_trend: z.enum(['improving', 'stable', 'declining']),
    top_themes: z.array(z.object({
      theme: z.string(),
      frequency: z.number(),
      sentiment: z.enum(['positive', 'neutral', 'negative']),
    })),
    emerging_concerns: z.array(z.string()),
  }),
  metrics: z.object({
    overall_sentiment: z.number().min(-1).max(1),
    satisfaction_score: z.number().min(0).max(1),
    nps_estimate: z.number().min(-100).max(100),
    positive_percentage: z.number().min(0).max(100),
    negative_percentage: z.number().min(0).max(100),
  }),
});

/**
 * API pour analyser les retours clients et générer une analyse marketing/com
 */
export async function POST(req: Request) {
  try {
    const { userId, periodStart, periodEnd, sourceIds } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "UserId manquant" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Clé API manquante" }, { status: 500 });
    }

    // Utiliser SERVICE_ROLE_KEY pour contourner les RLS (comme dans import et fetch-monitoring)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ [analyze] SUPABASE_SERVICE_ROLE_KEY manquante !');
      return NextResponse.json({ 
        error: "Configuration manquante: SUPABASE_SERVICE_ROLE_KEY doit être définie dans .env.local"
      }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabase = createClient(
      supabaseUrl!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ÉTAPE 1: Récupérer automatiquement les commentaires depuis les sources de surveillance actives
    const { data: monitoringSources } = await supabase
      .from('client_feedback_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('auto_monitoring', true)
      .eq('is_active', true);

    if (monitoringSources && monitoringSources.length > 0) {
      // Récupérer les commentaires depuis chaque source de surveillance
      for (const source of monitoringSources) {
        try {
          // Appeler l'API de récupération (utilise la même route mais peut être appelée ici)
          const fetchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/client-feedback/fetch-monitoring`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceId: source.id,
              userId,
            }),
          });
          
          // On continue même si une source échoue
          if (!fetchResponse.ok) {
            console.warn(`Échec récupération pour source ${source.id}`);
          }
        } catch (error) {
          console.error(`Erreur récupération source ${source.id}:`, error);
        }
      }
    }

    // ÉTAPE 2: Récupérer l'analyse précédente pour comparaison
    const { data: previousAnalyses } = await supabase
      .from('marketing_analysis')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    const previousAnalysis = previousAnalyses && previousAnalyses.length > 0 ? previousAnalyses[0] : null;

    // Récupérer les retours clients à analyser
    let query = supabase
      .from('client_feedback_items')
      .select('*')
      .eq('user_id', userId)
      .order('feedback_date', { ascending: false });

    if (periodStart) {
      query = query.gte('feedback_date', periodStart);
    }
    if (periodEnd) {
      query = query.lte('feedback_date', periodEnd);
    }
    if (sourceIds && sourceIds.length > 0) {
      query = query.in('source_id', sourceIds);
    }

    const { data: feedbackItems, error: fetchError } = await query.limit(1000);

    if (fetchError) {
      console.error("Erreur récupération feedback:", fetchError);
      return NextResponse.json({ error: "Erreur lors de la récupération des retours" }, { status: 500 });
    }

    if (!feedbackItems || feedbackItems.length === 0) {
      return NextResponse.json({ 
        error: "Aucun retour client à analyser pour cette période" 
      }, { status: 400 });
    }

    // Préparer les données pour l'IA
    const feedbackTexts = feedbackItems.map(item => ({
      id: item.id,
      content: item.content || item.summary || '',
      sentiment: item.sentiment,
      category: item.category,
      date: item.feedback_date,
      source: item.channel,
    }));

    // Calculer les statistiques de base
    const stats = {
      total: feedbackItems.length,
      positive: feedbackItems.filter(f => f.sentiment === 'positive').length,
      negative: feedbackItems.filter(f => f.sentiment === 'negative').length,
      neutral: feedbackItems.filter(f => f.sentiment === 'neutral' || !f.sentiment).length,
    };

    // Optimisation: réduire le nombre de retours et la longueur pour économiser des tokens
    const MAX_FEEDBACK_TO_ANALYZE = 50; // Réduit de 100 à 50
    const MAX_FEEDBACK_LENGTH = 300; // Réduit de 500 à 300 caractères
    
    const feedbackSummary = feedbackTexts
      .slice(0, MAX_FEEDBACK_TO_ANALYZE)
      .map(f => `[${f.sentiment || 'neutral'}] ${f.content.substring(0, MAX_FEEDBACK_LENGTH)}`)
      .join('\n\n---\n\n');

    // Préparer les données de comparaison si une analyse précédente existe
    let comparisonContext = '';
    if (previousAnalysis) {
      const prevStats = {
        sentiment: previousAnalysis.overall_sentiment,
        satisfaction: previousAnalysis.satisfaction_score,
        nps: previousAnalysis.nps_score,
        positive: previousAnalysis.positive_count,
        negative: previousAnalysis.negative_count,
        total: previousAnalysis.total_feedback_analyzed,
      };
      
      comparisonContext = `

===== ANALYSE PRÉCÉDENTE (${new Date(previousAnalysis.created_at).toLocaleDateString('fr-FR')}) =====
Statistiques précédentes :
- Sentiment global : ${prevStats.sentiment?.toFixed(2) || 'N/A'}
- Satisfaction : ${prevStats.satisfaction ? (prevStats.satisfaction * 100).toFixed(0) + '%' : 'N/A'}
- NPS : ${prevStats.nps?.toFixed(0) || 'N/A'}
- Positifs : ${prevStats.positive}/${prevStats.total}
- Négatifs : ${prevStats.negative}/${prevStats.total}

IMPORTANT : Compare cette nouvelle analyse avec la précédente. Identifie :
- Les tendances (amélioration/dégradation)
- Les nouveaux problèmes qui émergent
- Les problèmes qui persistent ou s'aggravent
- Les améliorations constatées
- L'évolution des priorités

===== ANALYSE ACTUELLE =====
`;
    }

    // Générer l'analyse avec l'IA
    const prompt = `Tu es un expert en marketing et communication d'entreprise français.

**RÈGLE ABSOLUE - LANGUE :** Tu dois répondre UNIQUEMENT en français. 
- Tous les titres doivent être en français
- Toutes les descriptions doivent être en français  
- Toutes les recommandations doivent être en français
- Tous les insights doivent être en français
- Tous les exemples doivent être en français
- Ne JAMAIS utiliser l'anglais, même pour les mots techniques. Utilise les équivalents français.

J'ai collecté ${stats.total} retours clients de différentes sources (emails, tickets support, avis en ligne, réseaux sociaux, enquêtes, entretiens).
${comparisonContext}
Statistiques actuelles :
- Positifs : ${stats.positive} (${Math.round(stats.positive/stats.total*100)}%)
- Négatifs : ${stats.negative} (${Math.round(stats.negative/stats.total*100)}%)
- Neutres : ${stats.neutral} (${Math.round(stats.neutral/stats.total*100)}%)

RETOURS CLIENTS À ANALYSER (échantillon représentatif) :
${feedbackSummary}

${feedbackItems.length > MAX_FEEDBACK_TO_ANALYZE ? `\n(Note: ${feedbackItems.length - MAX_FEEDBACK_TO_ANALYZE} retours supplémentaires sont pris en compte dans les statistiques mais non affichés dans le détail)` : ''}

Tâche : Analyser ces retours pour identifier CE QUI FAIT DÉFAUT et QUELS SONT LES LEVIERS marketing et communication.

RÈGLE ABSOLUE : Tous tes retours (titres, descriptions, recommandations, insights) doivent être écrits en français, pas en anglais.

Pour chaque élément identifié, fournis :
1. **FAIBLESSES** : Ce qui fait défaut selon les retours clients
   - Titre clair
   - Description détaillée
   - Niveau de gravité (low/medium/high/critical)
   - Impact business
   - Catégorie (product/service/communication/pricing/experience/support/other)
   - Exemples concrets tirés des retours
   - Fréquence (nombre de mentions)

2. **FORCES** : Ce qui fonctionne bien et est apprécié
   - Titre et description
   - Catégorie
   - Exemples

3. **LEVIERS** : Actions marketing/communication pour améliorer la situation
   - Titre et description
   - Type (marketing/communication/product/service/pricing/experience)
   - Priorité (low/medium/high/urgent)
   - Impact attendu
   - Actions concrètes à mettre en place
   - Ressources nécessaires (optionnel)

4. **OPPORTUNITÉS** : Opportunités identifiées dans les retours
5. **MENACES** : Risques identifiés
6. **INSIGHTS CLÉS** : Insights majeurs avec preuves
7. **RECOMMANDATIONS** : Recommandations actionnables prioritaires
8. **TENDANCES** : Tendances détectées (sentiment, thèmes, préoccupations émergentes)
9. **MÉTRIQUES** : Sentiment global, score de satisfaction, NPS estimé

Sois précis, actionnable, et base-toi uniquement sur les retours clients fournis.

IMPORTANT : Réponds UNIQUEMENT en français. Tous les titres, descriptions, recommandations, insights, exemples doivent être écrits en français.`;

    console.log('🤖 [analyze] Génération de l\'analyse avec l\'IA...');
    
    // Fonction helper pour gérer les rate limits avec retry et backoff exponentiel
    const generateWithRetry = async (maxRetries = 5, baseDelay = 1000) => {
      let lastError: any = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const result = await generateObject({
            model: openai('gpt-4o'),
            schema: AnalysisResultSchema,
            prompt,
            temperature: 0.3,
            maxOutputTokens: 4000, // Limiter les tokens de sortie aussi
          });
          return result;
        } catch (error: any) {
          lastError = error;
          
          // Vérifier si c'est une erreur de rate limit
          const isRateLimit = error.message?.includes('Rate limit') || 
                             error.message?.includes('rate limit') ||
                             error.message?.includes('rate_limit') ||
                             error.statusCode === 429;
          
          if (!isRateLimit || attempt === maxRetries - 1) {
            throw error;
          }
          
          // Extraire le temps d'attente suggéré depuis l'erreur si disponible
          let waitTime = baseDelay * Math.pow(2, attempt); // Backoff exponentiel
          const waitMatch = error.message?.match(/try again in ([\d.]+)s/);
          if (waitMatch) {
            waitTime = Math.max(waitTime, parseFloat(waitMatch[1]) * 1000 + 500); // +500ms de marge
          }
          
          console.warn(`⚠️ [analyze] Rate limit atteint (tentative ${attempt + 1}/${maxRetries}). Attente de ${Math.round(waitTime/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      throw lastError;
    };
    
    const { object: analysis } = await generateWithRetry();
    
    console.log('✅ [analyze] Analyse générée:', {
      weaknesses: analysis.weaknesses?.length || 0,
      strengths: analysis.strengths?.length || 0,
      levers: analysis.levers?.length || 0,
      opportunities: analysis.opportunities?.length || 0,
    });

    // Calculer les données de comparaison si une analyse précédente existe
    const comparisonData = previousAnalysis ? {
      previous_sentiment: previousAnalysis.overall_sentiment,
      previous_satisfaction: previousAnalysis.satisfaction_score,
      previous_nps: previousAnalysis.nps_score,
      previous_date: previousAnalysis.created_at,
      sentiment_change: analysis.metrics.overall_sentiment - (previousAnalysis.overall_sentiment || 0),
      satisfaction_change: analysis.metrics.satisfaction_score - (previousAnalysis.satisfaction_score || 0),
      nps_change: analysis.metrics.nps_estimate - (previousAnalysis.nps_score || 0),
      feedback_count_change: stats.total - (previousAnalysis.total_feedback_analyzed || 0),
    } : {};

    // Créer l'analyse dans la base de données
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('marketing_analysis')
      .insert({
        user_id: userId,
        analysis_type: periodStart || periodEnd ? 'periodic' : 'full',
        period_start: periodStart || null,
        period_end: periodEnd || null,
        previous_analysis_id: previousAnalysis?.id || null,
        comparison_data: comparisonData,
        weaknesses: analysis.weaknesses,
        strengths: analysis.strengths,
        levers: analysis.levers,
        opportunities: analysis.opportunities,
        threats: analysis.threats,
        key_insights: analysis.key_insights,
        recommendations: analysis.recommendations,
        trends: analysis.trends,
        overall_sentiment: analysis.metrics.overall_sentiment,
        satisfaction_score: analysis.metrics.satisfaction_score,
        nps_score: analysis.metrics.nps_estimate,
        top_themes: analysis.trends.top_themes.map(t => ({
          theme: t.theme,
          frequency: t.frequency,
          sentiment: t.sentiment,
        })),
        total_feedback_analyzed: stats.total,
        positive_count: stats.positive,
        negative_count: stats.negative,
        neutral_count: stats.neutral,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError) {
      console.error("Erreur sauvegarde analyse:", saveError);
      return NextResponse.json({ error: "Erreur lors de la sauvegarde de l'analyse" }, { status: 500 });
    }

    // Mettre à jour les feedback_items avec l'analysis_id
    await supabase
      .from('client_feedback_items')
      .update({ analysis_id: savedAnalysis.id })
      .in('id', feedbackItems.map(f => f.id));

    return NextResponse.json({
      success: true,
      analysis: savedAnalysis,
      message: "Analyse marketing/com générée avec succès",
    });
  } catch (error: any) {
    console.error("❌ ERREUR ANALYSE MARKETING:", error);
    
    // Gestion spécifique des rate limits avec message en français
    const isRateLimit = error.message?.includes('Rate limit') || 
                       error.message?.includes('rate limit') ||
                       error.message?.includes('rate_limit') ||
                       error.statusCode === 429;
    
    if (isRateLimit) {
      // Extraire le temps d'attente suggéré
      const waitMatch = error.message?.match(/try again in ([\d.]+)s/);
      const waitSeconds = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) : 10;
      
      return NextResponse.json({ 
        error: `Limite de requêtes OpenAI atteinte. La limite de tokens par minute (TPM) a été dépassée. Veuillez réessayer dans ${waitSeconds} secondes.`,
        errorCode: 'RATE_LIMIT',
        retryAfter: waitSeconds,
        suggestion: "Pour éviter cela à l'avenir, réduisez le nombre de retours clients analysés ou attendez quelques minutes entre les analyses."
      }, { status: 429 });
    }
    
    return NextResponse.json({ 
      error: error.message || "Erreur lors de l'analyse marketing",
      errorCode: 'ANALYSIS_ERROR'
    }, { status: 500 });
  }
}


// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

/**
 * API pour enregistrer le feedback utilisateur et déclencher l'apprentissage
 */
export async function POST(req: Request) {
  try {
    const { userId, messageId, threadId, feedbackType, rating, comment, correctionText, messageContent, userContext } = await req.json();

    if (!userId || !messageId || !feedbackType) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Enregistrer le feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from('message_feedback')
      .insert({
        user_id: userId,
        message_id: messageId,
        thread_id: threadId || null,
        feedback_type: feedbackType, // 'positive', 'negative', 'correction'
        rating: rating || null,
        comment: comment || null,
        correction_text: correctionText || null,
        message_content: messageContent || null,
        user_context: userContext || {},
      })
      .select()
      .single();

    if (feedbackError) {
      console.error("Erreur insertion feedback:", feedbackError);
      return NextResponse.json({ error: "Erreur lors de l'enregistrement du feedback" }, { status: 500 });
    }

    // Déclencher l'analyse et la mise à jour des préférences
    // Le trigger SQL mettra à jour automatiquement user_preferences, mais on peut aussi analyser le feedback ici
    await analyzeFeedbackAndUpdatePreferences(supabase, userId, feedback);
    
    // Si on a assez de feedback (10+), suggérer une analyse approfondie avec l'IA
    // L'analyse approfondie peut être déclenchée via /api/analyze-preferences
    const { count: feedbackCount } = await supabase
      .from('message_feedback')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (feedbackCount && feedbackCount >= 10 && feedbackCount % 5 === 0) {
      console.log(`[Apprentissage] ${feedbackCount} feedbacks collectés pour userId ${userId}. Analyse approfondie recommandée via /api/analyze-preferences`);
    }

    return NextResponse.json({ 
      success: true, 
      feedback,
      message: "Feedback enregistré avec succès. L'IA apprendra de cette interaction." 
    });
  } catch (error: any) {
    console.error("❌ ERREUR FEEDBACK:", error);
    return NextResponse.json({ error: error.message || "Erreur lors du traitement du feedback" }, { status: 500 });
  }
}

/**
 * Analyse le feedback et met à jour les préférences utilisateur de manière intelligente
 */
async function analyzeFeedbackAndUpdatePreferences(
  supabase: any,
  userId: string,
  feedback: any
) {
  try {
    // Récupérer les préférences actuelles
    const { data: currentPrefs } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Récupérer les derniers feedbacks pour analyser les patterns
    const { data: recentFeedback } = await supabase
      .from('message_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!recentFeedback || recentFeedback.length === 0) return;

    type FeedbackRow = { feedback_type: string; correction_text?: string | null; message_content?: string | null };
    const feedback = recentFeedback as FeedbackRow[];

    // Analyser les patterns
    const positiveCount = feedback.filter((f) => f.feedback_type === 'positive').length;
    const negativeCount = feedback.filter((f) => f.feedback_type === 'negative').length;
    const correctionCount = feedback.filter((f) => f.feedback_type === 'correction').length;

    // Analyser les commentaires et corrections pour détecter des préférences
    const learnedPrefs: any = currentPrefs?.learned_preferences || {};

    // Détecter les préférences basées sur les corrections
    const corrections = feedback.filter((f) => f.correction_text);
    if (corrections.length > 0) {
      // Analyser la longueur moyenne des réponses préférées
      const avgOriginalLength = corrections.reduce((sum, f) => sum + (f.message_content?.length || 0), 0) / corrections.length;
      const avgCorrectionLength = corrections.reduce((sum, f) => sum + (f.correction_text?.length || 0), 0) / corrections.length;
      
      if (avgCorrectionLength < avgOriginalLength * 0.7) {
        learnedPrefs.favor_short_answers = true;
      } else if (avgCorrectionLength > avgOriginalLength * 1.3) {
        learnedPrefs.favor_short_answers = false;
      }
      
      // Détecter si l'utilisateur préfère des exemples
      const correctionsWithExamples = corrections.filter(f => 
        f.correction_text?.toLowerCase().includes('exemple') || 
        f.correction_text?.toLowerCase().includes('par exemple')
      );
      if (correctionsWithExamples.length > corrections.length * 0.5) {
        learnedPrefs.prefer_examples = true;
      }
      
      // Détecter si l'utilisateur préfère les étapes numérotées
      const correctionsWithSteps = corrections.filter(f => 
        /^\d+[\.\)]/.test(f.correction_text || '') || 
        f.correction_text?.includes('Étape') ||
        f.correction_text?.includes('étape')
      );
      if (correctionsWithSteps.length > corrections.length * 0.4) {
        learnedPrefs.prefer_step_by_step = true;
      }
    }

    // Déterminer le style préféré basé sur les patterns de feedback
    let preferredStyle = currentPrefs?.preferred_style || 'balanced';
    let preferredDetailLevel = currentPrefs?.preferred_detail_level || 5;
    
    // Si beaucoup de feedback positif sur des réponses courtes
    const shortPositive = feedback.filter((f) =>
      f.feedback_type === 'positive' &&
      f.message_content &&
      f.message_content.length < 500
    );
    if (shortPositive.length > positiveCount * 0.6 && positiveCount > 2) {
      preferredStyle = 'concise';
      preferredDetailLevel = Math.max(1, preferredDetailLevel - 1);
    }

    // Si beaucoup de feedback positif sur des réponses longues/détaillées
    const longPositive = feedback.filter((f) =>
      f.feedback_type === 'positive' &&
      f.message_content &&
      f.message_content.length > 1000
    );
    if (longPositive.length > positiveCount * 0.6 && positiveCount > 2) {
      preferredStyle = 'detailed';
      preferredDetailLevel = Math.min(10, preferredDetailLevel + 1);
    }

    // Mettre à jour les préférences
    await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preferred_style: preferredStyle,
        preferred_detail_level: preferredDetailLevel,
        learned_preferences: learnedPrefs,
        updated_at: new Date().toISOString(),
        last_learning_update: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });
  } catch (error) {
    console.error("Erreur analyse feedback:", error);
    // Ne pas bloquer si l'analyse échoue
  }
}

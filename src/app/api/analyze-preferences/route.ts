// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = 'edge';

/**
 * API pour analyser les préférences utilisateur de manière plus approfondie
 * Utilise l'IA pour analyser les patterns de feedback et suggérer des préférences
 */
export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "UserId manquant" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Clé API manquante" }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer les derniers feedbacks (50 derniers)
    const { data: feedbacks } = await supabase
      .from('message_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!feedbacks || feedbacks.length < 3) {
      return NextResponse.json({ 
        success: false,
        message: "Pas assez de feedback pour analyser les préférences (minimum 3 feedbacks requis)" 
      });
    }

    // Analyser avec l'IA pour détecter les patterns
    const analysisPrompt = `Analyse les patterns de feedback suivants d'un utilisateur et détermine ses préférences de communication.

Feedback reçus (${feedbacks.length} interactions) :
${feedbacks.slice(0, 20).map((f, i) => `
${i + 1}. Type: ${f.feedback_type}
   ${f.rating ? `Note: ${f.rating}/5` : ''}
   ${f.comment ? `Commentaire: ${f.comment}` : ''}
   ${f.correction_text ? `Correction suggérée: ${f.correction_text.substring(0, 200)}...` : ''}
   Longueur réponse originale: ${f.message_content?.length || 0} caractères
`).join('\n')}

Analyse les patterns et détermine :
1. preferred_style : "concise" | "detailed" | "balanced" | "technical" | "pedagogical"
2. preferred_tone : "formal" | "casual" | "professional" | "friendly"
3. preferred_detail_level : nombre entre 1 (très court) et 10 (très détaillé)
4. perceived_expertise_level : "beginner" | "intermediate" | "advanced" | "expert"
5. learned_preferences : objet JSON avec des booléens pour :
   - favor_short_answers (préfère les réponses courtes)
   - prefer_examples (préfère les exemples)
   - prefer_step_by_step (préfère les étapes numérotées)
   - prefer_visual_descriptions (préfère les descriptions visuelles)

Réponds UNIQUEMENT avec un JSON valide :
{
  "preferred_style": "...",
  "preferred_tone": "...",
  "preferred_detail_level": ...,
  "perceived_expertise_level": "...",
  "learned_preferences": {
    "favor_short_answers": true/false,
    "prefer_examples": true/false,
    "prefer_step_by_step": true/false,
    "prefer_visual_descriptions": true/false
  },
  "reasoning": "Explication courte de l'analyse"
}`;

    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en analyse comportementale et préférences utilisateur.
          Tu analyses les patterns de feedback pour déterminer les préférences de communication.
          Tu réponds UNIQUEMENT en JSON valide.`,
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.3,
    });

    // Parser la réponse JSON
    let preferences: any = {};
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        preferences = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Erreur parsing préférences:", parseError);
      return NextResponse.json({ error: "Erreur lors de l'analyse" }, { status: 500 });
    }

    // Mettre à jour les préférences dans la base
    const { error: updateError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preferred_style: preferences.preferred_style || 'balanced',
        preferred_tone: preferences.preferred_tone || 'professional',
        preferred_detail_level: preferences.preferred_detail_level || 5,
        perceived_expertise_level: preferences.perceived_expertise_level || 'intermediate',
        learned_preferences: preferences.learned_preferences || {},
        updated_at: new Date().toISOString(),
        last_learning_update: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error("Erreur mise à jour préférences:", updateError);
      return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferences,
      reasoning: preferences.reasoning,
      message: "Préférences analysées et mises à jour avec succès"
    });
  } catch (error: any) {
    console.error("❌ ERREUR ANALYSE PRÉFÉRENCES:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de l'analyse" }, { status: 500 });
  }
}






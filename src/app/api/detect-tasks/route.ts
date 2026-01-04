import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

interface DetectedTask {
  title: string;
  description: string;
  frequency_score: number;
  repetitiveness_score: number;
  time_estimate_minutes?: number;
  ai_analysis: string;
  metadata: {
    source: 'document' | 'history' | 'external';
    document_id?: string;
    context?: string;
  };
}

export async function POST(req: Request) {
  try {
    const { content, userId, documentId, source = 'document' } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Clé API manquante" }), { status: 500 });
    }

    if (!content || !userId) {
      return new Response(JSON.stringify({ error: "Contenu ou utilisateur manquant" }), { status: 400 });
    }

    // Analyser le contenu avec l'IA pour détecter les tâches grises
    const analysisPrompt = `Tu es un expert en détection de tâches répétitives et automatisables dans les entreprises.
Analyse le contenu suivant et identifie les tâches "grises" (tâches répétitives qui pourraient être automatisées).

Pour chaque tâche détectée, fournis:
1. Un titre court et descriptif (max 60 caractères)
2. Une description détaillée
3. Un score de fréquence (0-100) - à quelle fréquence cette tâche est-elle mentionnée/effectuée
4. Un score de répétitivité (0-100) - dans quelle mesure cette tâche est répétitive
5. Une estimation du temps passé par occurrence en minutes (optionnel)
6. Une analyse IA expliquant pourquoi cette tâche est considérée comme "grise"

Format de réponse JSON (array):
[
  {
    "title": "Titre de la tâche",
    "description": "Description détaillée",
    "frequency_score": 85,
    "repetitiveness_score": 90,
    "time_estimate_minutes": 15,
    "ai_analysis": "Analyse détaillée de pourquoi c'est une tâche grise"
  }
]

CONTENU À ANALYSER:
${content.substring(0, 8000)}`;

    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en automatisation de processus d'entreprise. 
          Tu identifies les tâches répétitives qui peuvent être automatisées.
          Tu réponds UNIQUEMENT en JSON valide, sans texte additionnel.`,
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.3, // Plus déterministe pour une meilleure détection
    });

    // Parser la réponse JSON
    let detectedTasks: DetectedTask[] = [];
    try {
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        detectedTasks = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Erreur parsing JSON:", parseError);
      // Essayer de réparer le JSON ou retourner une structure vide
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'analyse", tasks: [] }),
        { status: 500 }
      );
    }

    // Enrichir avec les métadonnées
    const enrichedTasks = detectedTasks.map((task) => ({
      ...task,
      metadata: {
        source: source as 'document' | 'history' | 'external',
        document_id: documentId,
        context: content.substring(0, 200),
      },
    }));

    // Sauvegarder dans la base de données
    if (enrichedTasks.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const tasksToInsert = enrichedTasks.map((task) => ({
          user_id: userId,
          title: task.title,
          description: task.description,
          source: task.metadata.source,
          frequency_score: Math.min(100, Math.max(0, task.frequency_score)),
          repetitiveness_score: Math.min(100, Math.max(0, task.repetitiveness_score)),
          time_estimate_minutes: task.time_estimate_minutes || null,
          status: 'detected',
          metadata: task.metadata,
          ai_analysis: task.ai_analysis,
        }));

        const { error } = await supabase
          .from('gray_tasks')
          .insert(tasksToInsert);

        if (error) {
          console.error("Erreur insertion tâches:", error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tasks: enrichedTasks,
        count: enrichedTasks.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error("❌ ERREUR DÉTECTION TÂCHES:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur lors de la détection" }),
      { status: 500 }
    );
  }
}


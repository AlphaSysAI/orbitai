import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

interface UserAction {
  id: string;
  action_type: string;
  metadata: Record<string, any>;
  created_at: string;
}

export async function POST(req: Request) {
  try {
    const { userId, days = 30 } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Clé API manquante" }), { status: 500 });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Utilisateur manquant" }), { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Configuration Supabase manquante" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer les actions utilisateur des X derniers jours
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Récupérer les actions de la table user_actions (si disponible)
    const { data: actions } = await supabase
      .from('user_actions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    // Extraire les snapshots d'activité (activity_snapshot)
    const activitySnapshots = actions?.filter(a => a.action_type === 'activity_snapshot') || [];

    // Aussi analyser les messages et documents pour plus de contexte
    const { data: messages } = await supabase
      .from('messages')
      .select('content, created_at')
      .eq('user_id', userId)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    // Récupérer uniquement les documents du pilier Copilot (base de connaissances)
    const { data: documents } = await supabase
      .from('documents')
      .select('name, created_at')
      .eq('user_id', userId)
      .eq('pillar_id', 'copilot-transmission') // Filtrer uniquement les documents du pilier Copilot
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Construire un résumé de l'historique
    // Compter les actions par type
    const actionCounts: Record<string, number> = {};
    if (actions) {
      actions.forEach((action) => {
        actionCounts[action.action_type] = (actionCounts[action.action_type] || 0) + 1;
      });
    }

    // Analyser les applications les plus utilisées depuis les snapshots d'activité
    const appUsage: Record<string, number> = {};
    activitySnapshots.forEach((snapshot: any) => {
      const activeApp = snapshot.metadata?.active_window?.application;
      if (activeApp) {
        appUsage[activeApp] = (appUsage[activeApp] || 0) + 1;
      }
      
      // Compter aussi les applications ouvertes
      const apps = snapshot.metadata?.applications || [];
      apps.forEach((app: string) => {
        appUsage[app] = (appUsage[app] || 0) + 0.1; // Poids moindre pour apps ouvertes mais pas actives
      });
    });

    // Applications les plus utilisées
    const topApps = Object.entries(appUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([app, count]) => ({ app, count }));

    const historySummary = {
      actions_count: actions?.length || 0,
      activity_snapshots_count: activitySnapshots.length,
      messages_count: messages?.length || 0,
      documents_count: documents?.length || 0,
      action_types: actionCounts,
      top_applications: topApps,
      recent_actions: [
        ...(actions?.slice(0, 30).map(a => ({
          type: a.action_type,
          metadata: a.metadata,
          date: a.created_at,
        })) || []),
        ...(messages?.slice(0, 20).map(m => ({
          type: 'message',
          content: m.content.substring(0, 200),
          date: m.created_at,
        })) || []),
        ...(documents?.slice(0, 10).map(d => ({
          type: 'document_upload',
          name: d.name,
          date: d.created_at,
        })) || []),
      ],
    };

    // Analyser avec l'IA pour détecter les patterns répétitifs
    const analysisPrompt = `Analyse l'historique d'activités utilisateur suivant et identifie les tâches répétitives qui pourraient être automatisées.

Historique des ${days} derniers jours:
- ${historySummary.actions_count} actions enregistrées
- ${historySummary.activity_snapshots_count} snapshots d'activité
- ${historySummary.messages_count} messages envoyés
- ${historySummary.documents_count} documents uploadés

Applications les plus utilisées:
${historySummary.top_applications.map((a: any) => `- ${a.app}: ${Math.round(a.count)} occurrences`).join('\n')}

Répartition des actions:
${Object.entries(historySummary.action_types || {}).map(([type, count]) => `- ${type}: ${count} fois`).join('\n')}

Activités récentes:
${historySummary.recent_actions.map((a, i) => `${i + 1}. [${a.type}] ${a.type === 'message' ? a.content : a.name} (${a.date})`).join('\n')}

Identifie les patterns répétitifs et les tâches qui pourraient être automatisées.
Pour chaque tâche détectée, fournis:
1. Un titre court (max 60 caractères)
2. Une description
3. Un score de fréquence (0-100) basé sur la répétition observée
4. Un score de répétitivité (0-100)
5. Une estimation du temps (en minutes)
6. Une analyse expliquant le pattern détecté

Format JSON (array):
[
  {
    "title": "Titre",
    "description": "Description",
    "frequency_score": 85,
    "repetitiveness_score": 90,
    "time_estimate_minutes": 15,
    "ai_analysis": "Analyse du pattern"
  }
]`;

    const result = await generateText({
      model: openai('gpt-4o'),
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en analyse de patterns comportementaux et détection de tâches répétitives.
          Tu identifies les activités qui se répètent régulièrement et qui pourraient être automatisées.
          Tu réponds UNIQUEMENT en JSON valide.`,
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.3,
    });

    // Parser la réponse
    let detectedTasks: any[] = [];
    try {
      const jsonMatch = result.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        detectedTasks = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Erreur parsing JSON:", parseError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'analyse", tasks: [] }),
        { status: 500 }
      );
    }

    // Enrichir et sauvegarder
    if (detectedTasks.length > 0) {
      const tasksToInsert = detectedTasks.map((task) => ({
        user_id: userId,
        title: task.title,
        description: task.description,
        source: 'history',
        frequency_score: Math.min(100, Math.max(0, task.frequency_score)),
        repetitiveness_score: Math.min(100, Math.max(0, task.repetitiveness_score)),
        time_estimate_minutes: task.time_estimate_minutes || null,
        status: 'detected',
        metadata: {
          source: 'history',
          analysis_period_days: days,
          messages_analyzed: historySummary.messages_count,
          documents_analyzed: historySummary.documents_count,
        },
        ai_analysis: task.ai_analysis,
      }));

      const { error } = await supabase
        .from('gray_tasks')
        .insert(tasksToInsert);

      if (error) {
        console.error("Erreur insertion tâches:", error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tasks: detectedTasks,
        count: detectedTasks.length,
        history_summary: historySummary,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error("❌ ERREUR ANALYSE HISTORIQUE:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur lors de l'analyse" }),
      { status: 500 }
    );
  }
}


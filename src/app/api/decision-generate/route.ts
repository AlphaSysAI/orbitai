// Copyright © 2026 OrbitSys. Tous droits réservés.

import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const runtime = 'edge';

const ScenarioSchema = z.object({
  type: z.enum(['optimistic', 'pessimistic', 'realistic', 'worst-case', 'best-case']),
  title: z.string(),
  description: z.string(),
  probability: z.number().min(0).max(100).optional(),
  metrics: z.object({
    roi: z.number().optional(),
    cost: z.number().optional(),
    duration: z.number().optional(),
    risk: z.number().min(1).max(10).optional(),
    impact: z.number().min(1).max(10).optional(),
  }),
  swot: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
  }).optional(),
  recommendations: z.array(z.string()),
  timeline: z.object({
    milestones: z.array(z.object({
      month: z.number(),
      description: z.string(),
    })),
  }).optional(),
});

const ScenariosResponseSchema = z.object({
  scenarios: z.array(ScenarioSchema).min(3).max(5),
  summary: z.string(),
  recommendation: z.string(),
});

export async function POST(req: Request) {
  try {
    const { context, conversation } = await req.json();

    // Préparer le résumé des documents
    let documentsSummary = '';
    if (context.documents && context.documents.length > 0) {
      documentsSummary = '\n\nDOCUMENTS FOURNIS:\n';
      context.documents.forEach((doc: any) => {
        documentsSummary += `\n--- ${doc.name} ---\n${doc.content.substring(0, 3000)}\n`;
      });
    }

    const contextSummary = `
DÉCISION: ${context.question || 'Non spécifiée'}
TYPE: ${context.decisionType || 'Non spécifié'}
OBJECTIFS: ${context.objectives?.join(', ') || 'Non spécifiés'}
CONTRAINTES: ${context.constraints?.join(', ') || 'Aucune'}
OPTIONS: ${context.options?.join(', ') || 'Non spécifiées'}
TIMELINE: ${context.timeline || 'Non spécifiée'}
BUDGET: ${context.budget || 'Non spécifié'}
${documentsSummary}
`;

    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: ScenariosResponseSchema,
      prompt: `Tu es un expert en simulation décisionnelle. 

Basé sur cette conversation et ce contexte :

${contextSummary}

${conversation.map((m: any) => `${m.role}: ${m.content}`).join('\n\n')}

Génère entre 3 et 5 scénarios détaillés pour aider à prendre cette décision :

1. **Scénario Optimiste** : Le meilleur résultat possible
2. **Scénario Réaliste** : Le résultat le plus probable
3. **Scénario Pessimiste** : Le pire résultat raisonnable
4. **Autres scénarios** si pertinent (worst-case, best-case)

Pour chaque scénario, inclue :
- Un titre clair
- Une description détaillée
- Des métriques quantifiables (ROI, coûts, durée, risque 1-10, impact 1-10)
- Une analyse SWOT si pertinent
- Des recommandations actionnables
- Un timeline avec jalons si pertinent

Génère aussi un résumé global et une recommandation finale.`,
      temperature: 0.7,
    });

    return new Response(JSON.stringify(object), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("❌ ERREUR GÉNÉRATION SCÉNARIOS:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}


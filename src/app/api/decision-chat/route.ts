// Copyright © 2026 OrbitSys. Tous droits réservés.

import { streamText } from 'ai';

import { getModel, aiTimeoutSignal } from '@/lib/ai/model';
import {
  enforceAiRateLimitForRequest,
  AiRateLimitError,
  AI_RATE_LIMITS,
} from '@/lib/ai/rate-limit-request';
import { requireAuthOrResponse } from '@/server/auth/require-auth';

export const runtime = 'edge';
export const maxDuration = 30;

export async function POST(req: Request) {
  const denied = await requireAuthOrResponse(req);
  if (denied) return denied;

  try {
    await enforceAiRateLimitForRequest(req, 'chat', { rule: AI_RATE_LIMITS.chat });

    const { conversation, context, simulationId } = await req.json();

    // Construire le prompt système pour guider la conversation
    const systemPrompt = `Tu es OrbitAll, un expert en simulation décisionnelle et stratégie d'entreprise.

Ton rôle est de :
1. **Poser des questions pertinentes** pour comprendre le contexte de la décision
2. **Identifier les éléments clés** : objectifs, contraintes, parties prenantes, timeline, budget
3. **Déterminer quand tu as assez d'informations** pour générer des scénarios
4. **Poser des questions une par une** de manière naturelle et conversationnelle

Questions que tu dois explorer :
- Quelle est la décision exacte à prendre ?
- Quels sont les objectifs principaux ?
- Quelles sont les contraintes (budget, temps, ressources) ?
- Qui sont les parties prenantes ?
- Quelles sont les options envisagées ?
- Quel est le contexte du marché/secteur ?
- Y a-t-il des données historiques pertinentes ?

Si l'utilisateur a fourni des documents, utilise-les pour enrichir ta compréhension et pose des questions pertinentes basées sur leur contenu.

Quand tu auras collecté suffisamment d'informations, dis quelque chose comme :
"Parfait ! J'ai maintenant une bonne compréhension de votre situation. Je vais analyser et générer plusieurs scénarios pour vous aider à prendre une décision éclairée."

Sois professionnel, empathique et orienté solutions.`;

    // Préparer le contexte avec les documents si disponibles
    let contextInfo = '';
    if (context.documents && context.documents.length > 0) {
      contextInfo = '\n\nDOCUMENTS FOURNIS PAR L\'UTILISATEUR :\n';
      context.documents.forEach((doc: any) => {
        contextInfo += `\n--- Document: ${doc.name} ---\n${doc.content}\n`;
      });
    }

    const result = await streamText({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt + contextInfo },
        ...conversation.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        })),
      ],
      temperature: 0.7,
      abortSignal: aiTimeoutSignal(),
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    if (error instanceof AiRateLimitError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 429,
        headers: { 'Retry-After': String(error.retryAfterSeconds) },
      });
    }
    console.error("❌ ERREUR API DECISION CHAT:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}


import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // On vérifie si la clé est présente (pour le log)
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ CLÉ API MANQUANTE DANS .ENV");
      return new Response(JSON.stringify({ error: "Clé API manquante" }), { status: 500 });
    }

    const result = await streamText({
      model: openai('gpt-4o'), // Utilise 'gpt-4o-mini' si tu veux économiser
      messages,
      system: `Tu es OrbitAI, l'intelligence stratégique des entreprises pour lesquelles tu es en charge de piloter les décisions opérationnelles. 
           Tu es un expert en analyse de documents et en stratégie d'entreprise.
           Ton ton est professionnel, concis et visionnaire.
           Quand on te transmet un PDF, tu dois en extraire la substantifique moelle 
           et donner des conseils actionnables.
           Ne réponds jamais à des questions qui ne concernent pas le document fourni.`,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("❌ ERREUR API OPENAI:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
// Copyright © 2026 OrbitSys. Tous droits réservés.

import { streamText, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

/**
 * Recherche les passages pertinents dans les documents
 * Utilise une recherche par mots-clés améliorée
 */
function findRelevantPassages(query: string, documents: Array<{ name: string; full_text: string; id: string }>, maxPassages: number = 5): string {
  if (documents.length === 0) {
    return "Aucun document n'a été uploadé dans la base de connaissances.";
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2); // Mots de plus de 2 caractères

  // Scorer chaque document
  const scoredDocuments = documents.map(doc => {
    const textLower = doc.full_text.toLowerCase();
    
    // Score basé sur la présence des mots-clés
    let score = 0;
    queryWords.forEach(word => {
      const occurrences = (textLower.match(new RegExp(word, 'g')) || []).length;
      score += occurrences * (word.length > 4 ? 2 : 1); // Poids plus important pour les mots longs
    });

    // Bonus si la requête complète apparaît
    if (textLower.includes(queryLower)) {
      score += 50;
    }

    // Bonus si les premiers mots de la requête apparaissent ensemble
    if (queryWords.length >= 2) {
      const firstWords = queryWords.slice(0, 2).join(' ');
      if (textLower.includes(firstWords)) {
        score += 30;
      }
    }

    return { doc, score };
  });

  // Trier par score décroissant
  scoredDocuments.sort((a, b) => b.score - a.score);

  // Prendre les documents les plus pertinents
  const topDocs = scoredDocuments
    .filter(item => item.score > 0)
    .slice(0, maxPassages);

  if (topDocs.length === 0) {
    // Aucune correspondance exacte, retourner un extrait de chaque document
    return documents
      .slice(0, 3)
      .map((doc, idx) => `[Document ${idx + 1}: ${doc.name}]\n${doc.full_text.substring(0, 1000)}...`)
      .join('\n\n---\n\n');
  }

  // Extraire les passages pertinents de chaque document
  const passages: string[] = [];
  
  topDocs.forEach(({ doc }, index) => {
    const text = doc.full_text;
    
    // Trouver les positions des mots-clés
    const keywordPositions: number[] = [];
    queryWords.forEach(word => {
      let pos = text.toLowerCase().indexOf(word);
      while (pos !== -1) {
        keywordPositions.push(pos);
        pos = text.toLowerCase().indexOf(word, pos + 1);
      }
    });

    if (keywordPositions.length === 0) {
      // Pas de mots-clés trouvés, prendre le début du document
      passages.push(`[Document ${index + 1}: ${doc.name}]\n${text.substring(0, 1500)}...`);
    } else {
      // Trier les positions et prendre des passages autour des mots-clés
      keywordPositions.sort((a, b) => a - b);

      const firstPos = keywordPositions[0];
      if (firstPos === undefined) return;

      // Grouper les positions proches (dans un rayon de 500 caractères)
      const groups: number[][] = [];
      let currentGroup: number[] = [firstPos];

      for (let i = 1; i < keywordPositions.length; i++) {
        const pos = keywordPositions[i];
        if (pos === undefined) continue;
        const last = currentGroup[currentGroup.length - 1];
        if (last !== undefined && pos - last < 500) {
          currentGroup.push(pos);
        } else {
          groups.push(currentGroup);
          currentGroup = [pos];
        }
      }
      groups.push(currentGroup);

      // Extraire un passage pour chaque groupe (max 3 groupes par document)
      groups.slice(0, 3).forEach(group => {
        const start = Math.max(0, Math.min(...group) - 200);
        const end = Math.min(text.length, Math.max(...group) + 800);
        const passage = text.substring(start, end);
        passages.push(`[Document ${index + 1}: ${doc.name}]\n${passage}${end < text.length ? '...' : ''}`);
      });
    }
  });

  return passages.join('\n\n---\n\n');
}

export async function POST(req: Request) {
  try {
    const { messages, stream, userId } = await req.json();

    // On vérifie si la clé est présente (pour le log)
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ CLÉ API MANQUANTE DANS .ENV");
      return new Response(JSON.stringify({ error: "Clé API manquante" }), { status: 500 });
    }

    // Récupérer tous les documents de l'utilisateur depuis Supabase
    // (uniquement pour les conversations, pas pour la génération de titre)
    let documents: Array<{ name: string; full_text: string; id: string }> = [];
    let knowledgeBaseContext = "";
    let userPreferences: any = null;

    // Ne pas utiliser la base de connaissances pour la génération de titre (stream: false)
    const isTitleGeneration = stream === false;
    
    if (userId && !isTitleGeneration) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          // Récupérer les préférences utilisateur (pour personnalisation)
          const { data: prefs } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (prefs) {
            userPreferences = prefs;
          }
          
          // Récupérer uniquement les documents du pilier Copilot (base de connaissances)
          const { data: docs, error } = await supabase
            .from('documents')
            .select('id, name, full_text')
            .eq('user_id', userId)
            .eq('pillar_id', 'copilot-transmission') // Filtrer uniquement les documents du pilier Copilot
            .order('created_at', { ascending: false });

          if (!error && docs && docs.length > 0) {
            documents = docs;
            
            // Extraire la question de l'utilisateur (dernier message)
            const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
            if (lastUserMessage) {
              const relevantPassages = findRelevantPassages(lastUserMessage.content, documents, 5);
              knowledgeBaseContext = `\n\n# BASE DE CONNAISSANCES\n\nTu as accès à une base de connaissances constituée de ${documents.length} document(s) uploadé(s) par l'utilisateur. Voici les passages pertinents pour répondre à sa question :\n\n${relevantPassages}\n\n---\n\n`;
            }
          }
        }
      } catch (dbError) {
        console.error("Erreur récupération documents/préférences:", dbError);
        // Continuer sans la base de connaissances si erreur
      }
    }

    // Construire le prompt système
    let systemPrompt: string;
    
    if (isTitleGeneration) {
      // Pour la génération de titre, pas besoin de la base de connaissances
      systemPrompt = `Tu es un assistant qui génère des titres courts et descriptifs pour des conversations.
Génère un titre très court (maximum 6-8 mots) qui résume l'idée principale de la conversation.`;
    } else {
      // Pour les conversations normales, utiliser la base de connaissances + préférences utilisateur
      
      // Construire les instructions de personnalisation basées sur les préférences apprises
      let personalizationInstructions = "";
      
      if (userPreferences) {
        const { preferred_style, preferred_tone, preferred_detail_level, perceived_expertise_level, learned_preferences } = userPreferences;
        
        personalizationInstructions = `\n\n# PERSONNALISATION (Préférences apprises pour cet utilisateur)`;
        
        // Style préféré
        if (preferred_style === 'concise') {
          personalizationInstructions += `\n- STYLE : Sois concis et direct. Évite les explications trop longues.`;
        } else if (preferred_style === 'detailed') {
          personalizationInstructions += `\n- STYLE : Fournis des explications détaillées avec du contexte.`;
        } else if (preferred_style === 'technical') {
          personalizationInstructions += `\n- STYLE : Utilise un vocabulaire technique et assume un niveau d'expertise élevé.`;
        } else if (preferred_style === 'pedagogical') {
          personalizationInstructions += `\n- STYLE : Sois pédagogique avec des explications étape par étape et des exemples.`;
        }
        
        // Ton préféré
        if (preferred_tone === 'formal') {
          personalizationInstructions += `\n- TON : Utilise un ton formel et professionnel.`;
        } else if (preferred_tone === 'casual') {
          personalizationInstructions += `\n- TON : Utilise un ton plus décontracté et accessible.`;
        } else if (preferred_tone === 'friendly') {
          personalizationInstructions += `\n- TON : Sois chaleureux et bienveillant dans tes réponses.`;
        }
        
        // Niveau de détail
        if (preferred_detail_level) {
          if (preferred_detail_level <= 3) {
            personalizationInstructions += `\n- NIVEAU DE DÉTAIL : Réponses très courtes, points essentiels uniquement.`;
          } else if (preferred_detail_level >= 8) {
            personalizationInstructions += `\n- NIVEAU DE DÉTAIL : Réponses détaillées avec contexte, exemples et explications complètes.`;
          }
        }
        
        // Niveau d'expertise perçu
        if (perceived_expertise_level === 'beginner') {
          personalizationInstructions += `\n- CONTEXTE UTILISATEUR : L'utilisateur semble être débutant, adapte tes explications en conséquence.`;
        } else if (perceived_expertise_level === 'advanced' || perceived_expertise_level === 'expert') {
          personalizationInstructions += `\n- CONTEXTE UTILISATEUR : L'utilisateur a un niveau d'expertise élevé, tu peux utiliser des termes techniques et être direct.`;
        }
        
        // Préférences apprises spécifiques
        if (learned_preferences && typeof learned_preferences === 'object') {
          if (learned_preferences.favor_short_answers) {
            personalizationInstructions += `\n- PRÉFÉRENCE : Privilégie les réponses courtes et ciblées.`;
          }
          if (learned_preferences.prefer_examples) {
            personalizationInstructions += `\n- PRÉFÉRENCE : Inclus toujours des exemples concrets dans tes réponses.`;
          }
          if (learned_preferences.prefer_step_by_step) {
            personalizationInstructions += `\n- PRÉFÉRENCE : Structure tes réponses en étapes numérotées quand c'est pertinent.`;
          }
          if (learned_preferences.prefer_visual_descriptions) {
            personalizationInstructions += `\n- PRÉFÉRENCE : Utilise des descriptions visuelles et des analogies.`;
          }
        }
        
        personalizationInstructions += `\n`;
      }
      
      const baseSystemPrompt = `Tu es OrbitAI, l'assistant intelligent pour la transmission de savoir et l'onboarding dans les entreprises.

TON RÔLE :
- Aider les entreprises à sauvegarder et transmettre leur savoir interne
- Faciliter les transitions lors des départs d'employés
- Apporter du soutien lors de la prise de poste
- Répondre à toutes les questions basées sur la base de connaissances fournie

RÈGLES IMPORTANTES :
1. Tu dois répondre UNIQUEMENT en te basant sur les documents de la base de connaissances fournie
2. Si l'information n'est pas dans les documents, dis-le clairement : "Je n'ai pas trouvé cette information dans la base de connaissances. Peux-tu reformuler ta question ou uploader un document contenant cette information ?"
3. Cite toujours le(s) document(s) source(s) quand tu donnes une réponse : "[Source: Document X: nom_du_fichier.pdf]"
4. Si plusieurs documents contiennent l'information, cite tous les documents pertinents
5. Sois précis, concis et actionnable
6. Adapte ton niveau d'explication au contexte :
   - **Onboarding/Formation** : Plus détaillé, pédagogique, avec contexte et explications étape par étape
   - **Expert/Consultation** : Plus concis, direct, focalisé sur l'essentiel
7. Pour les **guides d'onboarding** ou **cours condensés** : Structure clairement l'information avec sections, sous-titres, listes à puces, et organise par thématiques ou processus logiques

${personalizationInstructions}Ton ton est professionnel, bienveillant et pédagogique, particulièrement adapté pour la transmission de savoir et l'accompagnement des nouveaux arrivants.`;

      systemPrompt = knowledgeBaseContext 
        ? `${baseSystemPrompt}${knowledgeBaseContext}Utilise UNIQUEMENT les informations contenues dans la base de connaissances ci-dessus pour répondre.`
        : `${baseSystemPrompt}\n\nATTENTION : Aucun document n'a été uploadé dans la base de connaissances pour le moment. Tu peux aider l'utilisateur à comprendre comment utiliser le système, mais pour répondre à des questions spécifiques sur les processus, procédures ou savoir-faire de l'entreprise, l'utilisateur doit d'abord uploader des documents PDF.`;
    }

    // Si stream est false, retourner le texte complet (pour la génération de titre par exemple)
    if (stream === false) {
      const result = await generateText({
        model: openai('gpt-4o'),
        messages,
        system: systemPrompt,
      });

      return new Response(result.text, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Sinon, streaming par défaut
    const result = await streamText({
      model: openai('gpt-4o'),
      messages,
      system: systemPrompt,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("❌ ERREUR API OPENAI:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
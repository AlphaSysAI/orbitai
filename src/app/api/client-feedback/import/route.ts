// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Edge runtime désactivé car il peut causer des problèmes avec les variables d'environnement et Supabase
// export const runtime = 'edge';

// Helper pour obtenir un client Supabase avec SERVICE_ROLE_KEY (contourne RLS)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * API pour importer des retours clients depuis différentes sources
 */
export async function POST(req: Request) {
  try {
    const { userId, sourceType, sourceName, items } = await req.json();

    if (!userId || !sourceType || !items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Clé API manquante" }, { status: 500 });
    }

    // Vérifier que SERVICE_ROLE_KEY est configurée (obligatoire pour contourner RLS)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ [import] SUPABASE_SERVICE_ROLE_KEY manquante !');
      return NextResponse.json({ 
        error: "Configuration manquante: SUPABASE_SERVICE_ROLE_KEY doit être définie dans .env.local pour contourner les politiques RLS",
        hint: "Trouvez cette clé dans Supabase Dashboard > Settings > API > service_role key (secret)"
      }, { status: 500 });
    }

    // Utiliser SERVICE_ROLE_KEY pour contourner les RLS (comme fetch-monitoring)
    const supabase = getSupabase();

    // Créer ou récupérer la source
    let { data: existingSources, error: sourceError } = await supabase
      .from('client_feedback_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('source_type', sourceType)
      .eq('source_name', sourceName)
      .limit(1);

    let source = existingSources && existingSources.length > 0 ? existingSources[0] : null;

    if (!source) {
      console.log('🔍 [import] Création nouvelle source:', { userId, sourceType, sourceName });
      
      const { data: newSource, error: createError } = await supabase
        .from('client_feedback_sources')
        .insert({
          user_id: userId,
          source_type: sourceType,
          source_name: sourceName,
          total_items: 0,
          is_active: true,
          auto_monitoring: false,
          monitoring_frequency: 'daily', // Valeur par défaut valide (hourly, daily, weekly)
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ [import] Erreur création source:', createError);
        console.error('❌ [import] Détails:', {
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          code: createError.code,
        });
        return NextResponse.json({ 
          error: `Erreur création source: ${createError.message || 'Erreur inconnue'}`,
          debug: {
            message: createError.message,
            details: createError.details,
            hint: createError.hint,
            code: createError.code,
          }
        }, { status: 500 });
      }
      
      if (!newSource) {
        console.error('❌ [import] Source créée mais data est null');
        return NextResponse.json({ 
          error: "Erreur création source: aucune donnée retournée"
        }, { status: 500 });
      }
      
      source = newSource;
      console.log('✅ [import] Source créée avec succès:', source.id);
    } else {
      console.log('✅ [import] Source existante trouvée:', source.id);
    }

    // Vérifier les doublons existants dans la base (basé sur le contenu et la source)
    const existingContents = await supabase
      .from('client_feedback_items')
      .select('content')
      .eq('source_id', source.id)
      .eq('user_id', userId);

    const existingContentSet = new Set(
      (existingContents.data || []).map(item => 
        item.content.trim().toLowerCase()
      )
    );

    console.log(`🔍 [import] ${existingContentSet.size} retours existants déjà dans cette source`);

    // Traiter chaque item avec l'IA pour extraction et classification
    const processedItems = await Promise.all(
      items.map(async (item: any) => {
        // Extraire les informations avec l'IA
        const extractionPrompt = `Analyse ce retour client et extrais les informations suivantes :

RETOUR CLIENT :
${item.content || item.text || item.message || JSON.stringify(item)}

Extrais :
1. Sentiment : positive, negative, neutral, ou mixed
2. Catégorie : bug, feature_request, complaint, praise, question, feedback, ou other
3. Urgence : low, medium, high, ou critical
4. Sujets principaux : liste de 3-5 tags/sujets mentionnés
5. Résumé : résumé court en une phrase

Réponds UNIQUEMENT avec un JSON valide :
{
  "sentiment": "positive|negative|neutral|mixed",
  "category": "bug|feature_request|complaint|praise|question|feedback|other",
  "urgency": "low|medium|high|critical",
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "résumé en une phrase"
}`;

        let extracted: {
          sentiment: string;
          category: string;
          urgency: string;
          tags: string[];
          summary: string;
        } = {
          sentiment: 'neutral',
          category: 'other',
          urgency: 'low',
          tags: [],
          summary: item.content?.substring(0, 200) || '',
        };

        try {
          const result = await generateText({
            model: openai('gpt-4o'),
            messages: [
              {
                role: 'system',
                content: 'Tu es un expert en analyse de retours clients. Tu réponds UNIQUEMENT en JSON valide.',
              },
              { role: 'user', content: extractionPrompt },
            ],
            temperature: 0.2,
          });

          const jsonMatch = result.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            extracted = JSON.parse(jsonMatch[0]);
          }
        } catch (error) {
          console.error("Erreur extraction IA:", error);
          // Continuer avec les valeurs par défaut
        }

        // Calculer un score de sentiment (-1 à 1)
        let sentimentScore = 0;
        if (extracted.sentiment === 'positive') sentimentScore = 0.7;
        else if (extracted.sentiment === 'negative') sentimentScore = -0.7;
        else if (extracted.sentiment === 'mixed') sentimentScore = 0;

        const content = item.content || item.text || item.message || '';
        const isDuplicate = existingContentSet.has(content.trim().toLowerCase());

        return {
          user_id: userId,
          source_id: source.id,
          content: content,
          summary: extracted.summary,
          raw_data: item,
          client_id: item.clientId || item.customer_id || item.user_id || null,
          client_email: item.email || item.client_email || null,
          client_name: item.name || item.client_name || item.customer_name || null,
          channel: item.channel || sourceType,
          category: extracted.category,
          sentiment: extracted.sentiment,
          sentiment_score: sentimentScore,
          urgency: extracted.urgency,
          topic_tags: extracted.tags,
          feedback_date: item.date || item.created_at || item.timestamp || new Date().toISOString(),
          _isDuplicate: isDuplicate, // Flag temporaire pour filtrer
        };
      })
    );

    // Filtrer les doublons
    const newItems = processedItems.filter(item => !item._isDuplicate);
    const duplicateCount = processedItems.length - newItems.length;
    
    // Nettoyer les flags temporaires
    const itemsToInsert = newItems.map(({ _isDuplicate, ...item }) => item);

    console.log(`📊 [import] ${itemsToInsert.length} nouveaux retours à insérer (${duplicateCount} doublons ignorés)`);

    if (itemsToInsert.length === 0) {
      // Compter le total réel dans la base
      const { count: realCount } = await supabase
        .from('client_feedback_items')
        .select('*', { count: 'exact', head: true })
        .eq('source_id', source.id)
        .eq('user_id', userId);

      return NextResponse.json({
        success: true,
        imported: 0,
        duplicates: duplicateCount,
        totalInSource: realCount || 0,
        sourceId: source.id,
        message: `Aucun nouveau retour importé. ${duplicateCount} doublon(s) détecté(s) et ignoré(s). Total dans la source : ${realCount || 0}`,
      });
    }

    // Insérer les nouveaux items dans la base
    const { data: insertedItems, error: insertError } = await supabase
      .from('client_feedback_items')
      .insert(itemsToInsert)
      .select();

    if (insertError) {
      console.error("Erreur insertion items:", insertError);
      return NextResponse.json({ error: "Erreur lors de l'insertion des retours" }, { status: 500 });
    }

    // Compter le total réel dans la base (plus fiable que le compteur)
    const { count: totalCount } = await supabase
      .from('client_feedback_items')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', source.id)
      .eq('user_id', userId);

    // Mettre à jour le compteur de la source avec le total réel
    await supabase
      .from('client_feedback_sources')
      .update({
        total_items: totalCount || 0,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id);

    const message = duplicateCount > 0
      ? `${itemsToInsert.length} nouveau(x) retour(s) importé(s). ${duplicateCount} doublon(s) ignoré(s). Total dans la source : ${totalCount || 0}`
      : `${itemsToInsert.length} retour(s) importé(s) avec succès. Total dans la source : ${totalCount || 0}`;

    console.log(`✅ [import] ${itemsToInsert.length} items insérés, total source: ${totalCount}`);

    return NextResponse.json({
      success: true,
      imported: itemsToInsert.length,
      duplicates: duplicateCount,
      totalInSource: totalCount || 0,
      sourceId: source.id,
      items: insertedItems,
      message,
    });
  } catch (error: any) {
    console.error("❌ ERREUR IMPORT FEEDBACK:", error);
    console.error("❌ Stack:", error.stack);
    return NextResponse.json({ 
      error: error.message || "Erreur lors de l'import",
      debug: {
        message: error.message,
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }
    }, { status: 500 });
  }
}


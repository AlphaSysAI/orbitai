import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Note: Cette API utilise la clé service role pour avoir accès complet
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * API pour récupérer automatiquement les commentaires depuis les sources de surveillance
 * Supporte Google Reviews, Trustpilot, et autres sources via scraping ou APIs
 */
export async function POST(request: Request) {
  try {
    const { sourceId, userId } = await request.json();

    console.log('🔍 [fetch-monitoring] Requête reçue:', { sourceId, userId });

    if (!sourceId || !userId) {
      return NextResponse.json(
        { error: 'sourceId et userId requis' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // D'abord, vérifier toutes les sources de cet utilisateur (pour debug)
    const { data: allUserSources } = await supabase
      .from('client_feedback_sources')
      .select('id, user_id, source_name')
      .eq('user_id', userId);
    
    console.log('📋 [fetch-monitoring] Toutes les sources de l\'utilisateur:', allUserSources);
    console.log('📋 [fetch-monitoring] Nombre de sources trouvées:', allUserSources?.length || 0);

    // Ensuite, chercher la source spécifique (sans filtre user_id d'abord pour voir si elle existe)
    const { data: sourcesById, error: sourceByIdError } = await supabase
      .from('client_feedback_sources')
      .select('*')
      .eq('id', sourceId)
      .limit(1);

    console.log('🔎 [fetch-monitoring] Recherche source avec ID:', sourceId);
    console.log('🔎 [fetch-monitoring] Résultat recherche par ID:', sourcesById);
    console.log('🔎 [fetch-monitoring] Erreur recherche:', sourceByIdError);

    if (sourceByIdError) {
      console.error('❌ Erreur récupération source:', sourceByIdError);
      return NextResponse.json(
        { 
          error: `Erreur lors de la récupération de la source: ${sourceByIdError.message}`,
          debug: { sourceId, userId }
        },
        { status: 500 }
      );
    }

    if (!sourcesById || sourcesById.length === 0) {
      console.error('❌ Source non trouvée avec ID:', sourceId);
      console.error('❌ UserId recherché:', userId);
      console.error('❌ Liste complète des sources de l\'utilisateur:', allUserSources);
      
      return NextResponse.json(
        { 
          error: `Source non trouvée avec l'ID: ${sourceId}`,
          debug: {
            sourceId,
            userId,
            userSourcesCount: allUserSources?.length || 0,
            userSources: allUserSources?.map(s => ({ id: s.id, name: s.source_name })) || []
          }
        },
        { status: 404 }
      );
    }

    // Récupérer la première source (devrait être unique par ID)
    const source = sourcesById[0];
    
    // Vérifier que le user_id correspond
    if (source.user_id !== userId) {
      console.error('❌ [fetch-monitoring] UserId ne correspond pas!');
      console.error('❌ [fetch-monitoring] Source user_id:', source.user_id);
      console.error('❌ [fetch-monitoring] Requête user_id:', userId);
      
      return NextResponse.json(
        { 
          error: `Source trouvée mais n'appartient pas à cet utilisateur`,
          debug: {
            sourceUserId: source.user_id,
            requestUserId: userId,
            sourceId: source.id,
            sourceName: source.source_name
          }
        },
        { status: 403 }
      );
    }

    console.log('✅ [fetch-monitoring] Source trouvée:', source.source_name);

    if (!source.monitoring_url || !source.auto_monitoring) {
      return NextResponse.json(
        { error: 'Source non configurée pour la surveillance automatique' },
        { status: 400 }
      );
    }

    // Détecter le type de source et récupérer les commentaires
    let comments: Array<{ content: string; date?: string; author?: string; rating?: number }> = [];

    // Valider l'URL
    if (!isValidMonitoringUrl(source.monitoring_url)) {
      return NextResponse.json(
        { error: 'URL invalide. Pour Google Reviews, utilisez une URL de type: https://www.google.com/maps/place/Nom-Entreprise/@...' },
        { status: 400 }
      );
    }

    if (source.monitoring_url.includes('google.com/maps') || source.monitoring_url.includes('maps.google.com')) {
      // Google Reviews - Note: nécessite une API key Google Places ou scraping
      console.log('🔍 [fetch-monitoring] Récupération avis Google pour:', source.monitoring_url);
      comments = await fetchGoogleReviews(source.monitoring_url);
      console.log(`📊 [fetch-monitoring] Résultat fetchGoogleReviews: ${comments.length} avis récupérés`);
    } else if (source.monitoring_url.includes('trustpilot.com')) {
      // Trustpilot - Note: nécessite une API key Trustpilot ou scraping
      comments = await fetchTrustpilotReviews(source.monitoring_url);
    } else {
      // Autres sources - scraping générique
      comments = await fetchGenericReviews(source.monitoring_url);
    }

    // Si aucun commentaire n'a été récupéré, vérifier la raison
    const isGoogleMaps = source.monitoring_url.includes('google.com/maps') || source.monitoring_url.includes('maps.google.com');
    const isTrustpilot = source.monitoring_url.includes('trustpilot.com');
    
    if (comments.length === 0) {
      // Vérifier si c'est parce que l'API key n'est pas configurée
      const apiKeyConfigured = process.env.GOOGLE_PLACES_API_KEY && isGoogleMaps;
      
      if (isGoogleMaps && !apiKeyConfigured) {
        // API key manquante
        return NextResponse.json({
          success: true,
          message: '✅ URL valide ! La récupération automatique des avis nécessite une clé API (Google Places API). Consultez SETUP_GOOGLE_PLACES_API.md pour les instructions. La source est enregistrée et sera utilisée automatiquement une fois l\'API configurée.',
          fetched: 0,
          items: [],
          requires_api: true,
        });
      } else if (isGoogleMaps && apiKeyConfigured) {
        // API key configurée mais aucun avis récupéré - probablement un problème avec l'URL ou le place_id
        return NextResponse.json({
          success: false,
          error: 'Aucun avis récupéré. Vérifiez la console pour plus de détails. Possible causes: place_id introuvable, établissement sans avis, ou erreur API.',
          fetched: 0,
          items: [],
        });
      } else if (!isGoogleMaps && !isTrustpilot) {
        return NextResponse.json({
          success: true,
          message: 'Aucun commentaire trouvé pour cette source. Vérifiez que l\'URL est correcte et contient des avis/commentaires.',
          fetched: 0,
          items: [],
        });
      }
    }

    // Enregistrer les nouveaux commentaires
    const newItems = [];
    let skippedCount = 0;
    
    console.log(`💾 [fetch-monitoring] Enregistrement de ${comments.length} commentaires...`);
    
    for (const comment of comments) {
      // Vérifier si le commentaire existe déjà (éviter les doublons)
      // Utiliser une comparaison plus souple (premiers caractères + date approximative)
      const contentPreview = comment.content.substring(0, 100);
      
      const { data: existingItems } = await supabase
        .from('client_feedback_items')
        .select('id')
        .eq('source_id', source.id)
        .eq('user_id', userId)
        .ilike('content', `${contentPreview}%`)
        .limit(1);

      if (existingItems && existingItems.length > 0) {
        skippedCount++;
        continue; // Déjà existant
      }

      // Calculer le sentiment basé sur la note
      let sentiment = 'neutral';
      let sentimentScore = 0;
      if (comment.rating !== undefined) {
        if (comment.rating >= 4) {
          sentiment = 'positive';
          sentimentScore = (comment.rating - 3) / 2; // Normaliser entre -1 et 1
        } else if (comment.rating <= 2) {
          sentiment = 'negative';
          sentimentScore = (comment.rating - 3) / 2;
        }
      }

      // Insérer le nouvel item
      const { data: item, error: itemError } = await supabase
        .from('client_feedback_items')
        .insert({
          user_id: userId,
          source_id: source.id,
          content: comment.content,
          summary: comment.content.substring(0, 200),
          rating: comment.rating && comment.rating >= 1 && comment.rating <= 5 ? comment.rating : null, // Stocker la note directement
          raw_data: {
            author: comment.author,
            rating: comment.rating,
            fetched_at: new Date().toISOString(),
          },
          channel: 'review',
          category: 'feedback',
          sentiment: sentiment,
          sentiment_score: sentimentScore,
          urgency: 'low',
          topic_tags: [],
          feedback_date: comment.date ? new Date(comment.date).toISOString() : new Date().toISOString(),
        })
        .select()
        .single();

      if (itemError) {
        console.error('❌ [fetch-monitoring] Erreur insertion item:', itemError);
      } else if (item) {
        newItems.push(item);
      }
    }
    
    console.log(`✅ [fetch-monitoring] ${newItems.length} nouveaux items enregistrés, ${skippedCount} doublons ignorés`);

    // Mettre à jour la source avec la date de dernière synchronisation
    // Recalculer le total depuis la base (plus fiable)
    const { count: totalCount } = await supabase
      .from('client_feedback_items')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', source.id)
      .eq('user_id', userId);

    await supabase
      .from('client_feedback_sources')
      .update({
        last_sync_at: new Date().toISOString(),
        total_items: totalCount || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id);
    
    console.log(`💾 [fetch-monitoring] Source mise à jour: total_items=${totalCount || 0}`);

    console.log(`📤 [fetch-monitoring] Retour réponse: success=true, fetched=${newItems.length}, total_comments=${comments.length}`);
    
    return NextResponse.json({
      success: true,
      fetched: newItems.length,
      total_available: comments.length,
      skipped: skippedCount,
      items: newItems,
      message: newItems.length > 0 
        ? `${newItems.length} nouveau(x) avis récupéré(s) et enregistré(s)${skippedCount > 0 ? `, ${skippedCount} doublon(s) ignoré(s)` : ''}`
        : skippedCount > 0 
          ? `${skippedCount} avis déjà enregistrés, aucun nouveau avis`
          : 'Aucun avis récupéré',
    });

  } catch (error: any) {
    console.error('Error fetching monitoring:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

/**
 * Valide que l'URL est une URL de surveillance valide
 */
function isValidMonitoringUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) {
    return false;
  }
  
  // Rejeter les URLs de recherche Google
  if (url.includes('google.com/search')) {
    return false;
  }
  
  // Accepter les URLs Google Maps
  if (url.includes('google.com/maps') || url.includes('maps.google.com')) {
    return true;
  }
  
  // Accepter Trustpilot
  if (url.includes('trustpilot.com')) {
    return true;
  }
  
  // Accepter d'autres URLs valides
  return true;
}

/**
 * Récupère les avis Google Reviews
 * Note: Pour une production, utiliser l'API Google Places avec une clé API
 * 
 * IMPORTANT: Pour obtenir la bonne URL Google Maps:
 * 1. Allez sur Google Maps
 * 2. Recherchez votre entreprise
 * 3. Cliquez sur l'entreprise
 * 4. Copiez l'URL complète de la page (elle ressemble à: https://www.google.com/maps/place/Nom-Entreprise/@latitude,longitude)
 * 5. Cette URL contient les avis dans la section "Avis"
 */
async function fetchGoogleReviews(url: string): Promise<Array<{ content: string; date?: string; author?: string; rating?: number }>> {
  try {
    // Vérifier que c'est bien une URL Google Maps (pas une recherche)
    if (!url.includes('/place/')) {
      throw new Error('URL invalide. Utilisez une URL Google Maps de type: https://www.google.com/maps/place/Nom-Entreprise/@...');
    }
    
    // Vérifier si la clé API est configurée
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    console.log(`🔑 [fetchGoogleReviews] Clé API configurée: ${apiKey ? 'OUI (' + apiKey.substring(0, 10) + '...)' : 'NON'}`);
    if (!apiKey) {
      console.error('❌ [fetchGoogleReviews] Google Reviews: Clé API non configurée. Ajoutez GOOGLE_PLACES_API_KEY dans votre fichier .env.local');
      throw new Error('Clé API Google Places non configurée. Consultez SETUP_GOOGLE_PLACES_API.md pour les instructions.');
    }
    
    // Extraire le place_id de l'URL Google Maps
    // L'URL Google Maps peut contenir le place_id de différentes façons
    let placeId: string | null = null;
    
    // Méthode 1: Extraire le nom de l'établissement et les coordonnées de l'URL
    const placeMatch = url.match(/\/place\/([^/@]+)/);
    const coordsMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    
    if (coordsMatch && placeMatch && placeMatch[1]) {
      const lat = coordsMatch[1];
      const lng = coordsMatch[2];
      const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      
      console.log('🔍 [fetchGoogleReviews] Recherche place_id avec:', { lat, lng, placeName });
      
      try {
        // Utiliser l'API Places Text Search pour trouver le place_id
        // Plus fiable que Geocoding pour les établissements
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placeName)}&location=${lat},${lng}&radius=50&key=${apiKey}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (searchData.status === 'OK' && searchData.results && searchData.results.length > 0) {
          // Prendre le premier résultat (le plus proche des coordonnées)
          placeId = searchData.results[0].place_id;
          console.log('✅ [fetchGoogleReviews] Place_id trouvé via Text Search:', placeId);
        } else if (searchData.status === 'ZERO_RESULTS') {
          // Si Text Search ne trouve rien, utiliser Geocoding inverse
          console.log('⚠️ [fetchGoogleReviews] Text Search vide, utilisation de Geocoding inverse...');
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
          const geocodeResponse = await fetch(geocodeUrl);
          const geocodeData = await geocodeResponse.json();
          
          if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
            // Chercher un résultat avec place_id dans les types appropriés
            const placeResult = geocodeData.results.find((r: any) => 
              r.place_id && (
                r.types.includes('establishment') || 
                r.types.includes('point_of_interest') ||
                r.types.includes('store') ||
                r.types.includes('restaurant')
              )
            ) || geocodeData.results[0];
            
            if (placeResult?.place_id) {
              placeId = placeResult.place_id;
              console.log('✅ [fetchGoogleReviews] Place_id trouvé via Geocoding:', placeId);
            }
          }
        }
      } catch (error) {
        console.error('❌ [fetchGoogleReviews] Erreur lors de la recherche du place_id:', error);
      }
    }
    
    if (!placeId) {
      console.warn('⚠️ [fetchGoogleReviews] Impossible d\'extraire le place_id de l\'URL.');
      console.warn('URL fournie:', url);
      throw new Error('Impossible de trouver le place_id depuis l\'URL Google Maps. Vérifiez que l\'URL contient bien les coordonnées et le nom de l\'établissement.');
    }
    
    // Récupérer TOUS les avis avec pagination
    // L'API Google Places v1 retourne jusqu'à 5 avis par page avec next_page_token
    let allComments: Array<{ content: string; date?: string; author?: string; rating?: number }> = [];
    let nextPageToken: string | null = null;
    let pageCount = 0;
    const maxPages = 20; // Limite de sécurité (20 pages × 5 avis = 100 avis max)
    let totalReviewsOnGoogle = 0;
    
    console.log('🔍 [fetchGoogleReviews] Début récupération avec pagination...');
    
    do {
      pageCount++;
      
      // Construire l'URL selon si c'est la première page ou une page suivante
      let placesUrl: string;
      if (nextPageToken) {
        // Page suivante avec le token de pagination
        // IMPORTANT: Il faut attendre quelques secondes entre les requêtes (limitation Google)
        await new Promise(resolve => setTimeout(resolve, 2000));
        placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}&pagetoken=${nextPageToken}`;
      } else {
        // Première page
        placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}`;
      }
      
      const placesResponse = await fetch(placesUrl);
      const placesData = await placesResponse.json();
      
      console.log(`🔍 [fetchGoogleReviews] Page ${pageCount} - Status: ${placesData.status}, Reviews count: ${placesData.result?.reviews?.length || 0}`);
      
      if (placesData.status !== 'OK') {
        if (placesData.status === 'INVALID_REQUEST' && nextPageToken) {
          // Le token de pagination peut être invalide si on n'a pas attendu assez longtemps
          console.warn('⚠️ [fetchGoogleReviews] Token de pagination invalide (attente insuffisante), arrêt de la pagination');
          break;
        }
        console.error('❌ [fetchGoogleReviews] Erreur API Google Places:', placesData.status, placesData.error_message);
        console.error('❌ [fetchGoogleReviews] URL utilisée:', placesUrl.replace(apiKey, 'HIDDEN_KEY'));
        if (pageCount === 1) {
          // Si c'est la première page qui échoue, throw l'erreur
          throw new Error(`Erreur API Google Places: ${placesData.error_message || placesData.status}`);
        } else {
          // Sinon, on arrête la pagination mais on retourne ce qu'on a déjà
          console.warn('⚠️ [fetchGoogleReviews] Arrêt de la pagination, retour des avis déjà récupérés');
          break;
        }
      }
      
      // Récupérer le total d'avis sur Google (première page seulement)
      if (pageCount === 1 && placesData.result?.user_ratings_total) {
        totalReviewsOnGoogle = placesData.result.user_ratings_total;
        console.log(`📊 [fetchGoogleReviews] Total avis sur Google: ${totalReviewsOnGoogle}`);
      }
      
      if (placesData.result?.reviews && placesData.result.reviews.length > 0) {
        const pageComments = placesData.result.reviews.map((review: any) => ({
          content: review.text || '',
          date: review.time ? new Date(review.time * 1000).toISOString() : undefined,
          author: review.author_name || undefined,
          rating: review.rating || undefined,
        }));
        
        console.log(`📄 [fetchGoogleReviews] Page ${pageCount}: ${pageComments.length} avis récupérés`);
        console.log(`📄 [fetchGoogleReviews] Exemple avis:`, pageComments[0] ? {
          content: pageComments[0].content.substring(0, 50) + '...',
          rating: pageComments[0].rating,
          author: pageComments[0].author
        } : 'aucun');
        
        allComments = allComments.concat(pageComments);
        console.log(`📊 [fetchGoogleReviews] Total cumulé: ${allComments.length} avis`);
        
        // Récupérer le token pour la page suivante
        nextPageToken = placesData.result.next_page_token || null;
        console.log(`🔑 [fetchGoogleReviews] Next page token: ${nextPageToken ? 'présent' : 'absent'}`);
        
        // Si pas de next_page_token, on a récupéré tous les avis disponibles
        if (!nextPageToken) {
          console.log('✅ [fetchGoogleReviews] Plus de pages disponibles, tous les avis récupérés');
          break;
        }
      } else {
        // Plus d'avis
        console.log(`⚠️ [fetchGoogleReviews] Page ${pageCount}: Aucun avis dans cette page`);
        nextPageToken = null;
      }
      
      // Limite de sécurité
      if (pageCount >= maxPages) {
        console.warn(`⚠️ [fetchGoogleReviews] Limite de ${maxPages} pages atteinte (${maxPages * 5} avis max)`);
        break;
      }
      
    } while (nextPageToken);
    
    console.log(`✅ [fetchGoogleReviews] Récupération terminée: ${allComments.length} avis récupérés sur ${totalReviewsOnGoogle} total`);
    
    if (totalReviewsOnGoogle > allComments.length) {
      console.info(`ℹ️ [fetchGoogleReviews] ${allComments.length} avis récupérés sur ${totalReviewsOnGoogle} total disponibles. L'API Google Places peut limiter le nombre d'avis récupérables.`);
    }
    
    return allComments;
    
  } catch (error: any) {
    console.error('Error fetching Google Reviews:', error);
    // Ne pas throw pour ne pas bloquer le processus si l'API échoue
    // On retourne un tableau vide et un message sera affiché
    return [];
  }
}

/**
 * Récupère les avis Trustpilot
 * Note: Pour une production, utiliser l'API Trustpilot Business
 */
async function fetchTrustpilotReviews(url: string): Promise<Array<{ content: string; date?: string; author?: string; rating?: number }>> {
  // TODO: Implémenter avec l'API Trustpilot
  // Pour l'instant, retourne un exemple vide
  
  try {
    // Exemple de structure
    return [];
  } catch (error) {
    console.error('Error fetching Trustpilot Reviews:', error);
    return [];
  }
}

/**
 * Récupération générique via scraping (basique)
 * Note: Le scraping nécessite des outils comme Puppeteer ou Cheerio
 */
async function fetchGenericReviews(url: string): Promise<Array<{ content: string; date?: string; author?: string; rating?: number }>> {
  // TODO: Implémenter avec Puppeteer ou Cheerio pour le scraping
  // Pour l'instant, retourne un tableau vide
  
  try {
    // Pour une implémentation complète:
    // 1. Charger la page avec Puppeteer
    // 2. Extraire les commentaires selon les sélecteurs CSS
    // 3. Parser les dates et auteurs
    
    return [];
  } catch (error) {
    console.error('Error fetching generic reviews:', error);
    return [];
  }
}

/**
 * Analyse simple du sentiment (basique, peut être amélioré avec l'IA)
 */
function analyzeSentimentSimple(text: string): 'positive' | 'neutral' | 'negative' {
  const lowerText = text.toLowerCase();
  const positiveWords = ['excellent', 'super', 'génial', 'parfait', 'recommandé', 'merci', 'satisfait', 'content', 'top'];
  const negativeWords = ['nul', 'déçu', 'horrible', 'mal', 'problème', 'insatisfait', 'pire', 'éviter'];
  
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}


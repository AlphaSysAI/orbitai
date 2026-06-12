# Configuration de la Clé API Google Places

## Pourquoi cette clé API ?

Pour récupérer automatiquement les avis Google Reviews, vous devez utiliser l'API Google Places. Cette API nécessite une clé API pour fonctionner.

## Comment obtenir une clé API Google Places

**Important** : La clé API Google Places n'a PAS besoin d'appartenir au propriétaire de la page Google Maps à surveiller. Vous pouvez créer une seule clé API pour votre application OrbitAI et l'utiliser pour surveiller n'importe quelle page Google Maps publique (avis publics).

### Étape 1: Créer un projet sur Google Cloud Console

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Notez le nom de votre projet
4. **Pas besoin d'être le propriétaire des pages à surveiller** - vous surveillez des données publiques

### Étape 2: Activer l'API Google Places

1. Dans la barre de recherche, tapez "Places API"
2. Sélectionnez "Places API" (nouvelle version recommandée)
3. Cliquez sur "Activer"
4. Cette API permet d'accéder aux données publiques de n'importe quel établissement sur Google Maps

### Étape 3: Créer une clé API

1. Allez dans "APIs & Services" > "Identifiants"
2. Cliquez sur "Créer des identifiants" > "Clé API"
3. Une nouvelle clé API sera générée
4. **Important**: Cliquez sur la clé API pour la configurer :
   - **Restrictions d'application** : Restreignez par domaine/IP si possible
   - **Restrictions d'API** : Limitez à "Places API (New)" uniquement pour la sécurité
5. Copiez votre clé API

### Étape 4: Ajouter la clé dans votre projet

1. Créez un fichier `.env.local` à la racine du projet (s'il n'existe pas)
2. Ajoutez la ligne suivante :

```env
GOOGLE_PLACES_API_KEY=votre_cle_api_ici
```

3. Redémarrez votre serveur de développement (`npm run dev`)

### Étape 5: Vérifier que ça fonctionne

1. Allez dans le Pilier 5 > Onglet "Surveillance"
2. Ajoutez une source Google Maps avec l'URL de votre entreprise
3. Cliquez sur "Tester la connexion"
4. Les avis devraient être récupérés automatiquement !

## Coûts

L'API Google Places utilise un système de facturation basé sur les requêtes :
- Les premières requêtes sont souvent gratuites (crédit de démarrage de $200/mois)
- Consultez la [page de tarification](https://mapsplatform.google.com/pricing/) pour plus de détails
- Pour les avis, l'endpoint utilisé est "Place Details" qui coûte environ $0.017 par requête
- **Vous facturez les requêtes, pas les propriétaires des pages surveillées** - c'est à votre entreprise/application de gérer les coûts

## Sécurité

⚠️ **IMPORTANT** : Ne commitez JAMAIS votre clé API dans Git !

- Le fichier `.env.local` est déjà dans `.gitignore`
- Configurez des restrictions sur votre clé API dans Google Cloud Console :
  - **Restrictions d'application** : Limitez par domaine (ex: `orbitai.com`) ou par IP si vous avez une IP fixe
  - **Restrictions d'API** : Limitez à "Places API (New)" uniquement pour minimiser les risques
- Limitez l'utilisation à votre domaine de production uniquement

## Qui paie les coûts ?

La clé API Google Places est associée à votre compte Google Cloud. **C'est donc VOUS (ou votre entreprise) qui paierez les coûts d'utilisation de l'API**, pas les propriétaires des pages Google Maps que vous surveillez.

- Si vous développez OrbitAI pour votre propre usage : vous payez les coûts
- Si OrbitAI est un SaaS : vous pouvez facturer vos clients pour ce service, ou l'inclure dans votre abonnement

## Documentation

- [Documentation Google Places API](https://developers.google.com/maps/documentation/places/web-service)
- [Guide de démarrage rapide](https://developers.google.com/maps/documentation/places/web-service/overview)


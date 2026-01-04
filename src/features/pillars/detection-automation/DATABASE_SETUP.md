# Configuration de la base de données - Détection & Automatisation

## Étapes de configuration

1. **Ouvrir la console SQL de Supabase**
   - Allez dans votre projet Supabase
   - Ouvrez le SQL Editor

2. **Exécuter le script de création**
   - Copiez le contenu du fichier `setup.sql`
   - Collez-le dans l'éditeur SQL
   - Exécutez le script

3. **Vérifier les tables créées**
   Les tables suivantes devraient être créées :
   - `gray_tasks` : Tâches grises détectées
   - `automations` : Automatisations configurées
   - `automation_executions` : Historique d'exécution

4. **Vérifier les politiques RLS**
   Les politiques Row Level Security (RLS) sont automatiquement configurées pour que chaque utilisateur ne voie que ses propres données.

## Structure des données

### Table `gray_tasks`
- Stocke les tâches grises détectées
- Sources possibles : `document`, `history`, `manual`, `external`
- Statuts : `detected`, `analyzing`, `automating`, `automated`, `ignored`
- Scores calculés automatiquement par l'IA : `frequency_score`, `repetitiveness_score`

### Table `automations`
- Stocke les configurations d'automatisation
- Types : `email`, `file`, `webhook`, `internal`, `custom`
- Statuts : `active`, `paused`, `archived`, `error`

### Table `automation_executions`
- Historique des exécutions d'automatisations
- Logs et résultats des exécutions

### Table `user_actions`
- Historique des actions utilisateur pour détection de patterns
- Types d'actions : `document_upload`, `message_sent`, `task_created`, `automation_created`, etc.
- Utilisée pour analyser les patterns répétitifs

## Fonctionnalités de détection automatique

### 1. Détection depuis les documents
- **Déclenchement** : Automatique lors de l'upload d'un PDF dans le pilier Copilot
- **Processus** :
  1. Le document est extrait via `/api/extract`
  2. Le contenu est analysé par l'IA via `/api/detect-tasks`
  3. Les tâches grises sont détectées et sauvegardées automatiquement
- **Analyse** : L'IA identifie les tâches répétitives mentionnées dans le document

### 2. Détection depuis l'historique
- **Déclenchement** : Manuel via le bouton "Analyser l'historique" dans la vue d'ensemble
- **Processus** :
  1. Analyse des actions des 30 derniers jours (par défaut)
  2. Analyse des messages et documents récents
  3. Détection de patterns répétitifs via `/api/analyze-history`
  4. Calcul automatique des scores de fréquence et répétitivité
- **Analyse** : L'IA identifie les activités qui se répètent régulièrement

### 3. Suivi automatique des actions
- Les actions suivantes sont automatiquement enregistrées :
  - Upload de documents
  - Envoi de messages
  - Création de tâches
  - Création d'automatisations
- Permet de construire un historique pour l'analyse future

### 4. Calcul automatique des scores
- **Frequency Score (0-100)** : Calculé par l'IA basé sur la fréquence d'occurrence
- **Repetitiveness Score (0-100)** : Calculé par l'IA basé sur le niveau de répétitivité
- Ces scores sont générés automatiquement lors de la détection

## Notes importantes

- Toutes les tables utilisent RLS (Row Level Security)
- Les données sont automatiquement filtrées par `user_id`
- Les timestamps sont gérés automatiquement
- La détection se fait en arrière-plan et n'interrompt pas le flux utilisateur
- Les erreurs de détection sont gérées silencieusement pour ne pas perturber l'expérience


# Documentation Technique - OrbitAI

## Vue d'ensemble

**OrbitAI** est une plateforme SaaS d'intelligence artificielle stratégique pour entreprises. Le système s'articule autour de 5 "piliers" fonctionnels qui couvrent différents aspects de l'optimisation opérationnelle et décisionnelle.

### Architecture Générale

- **Framework Frontend** : Next.js 15 (App Router) avec React 19
- **Backend** : API Routes Next.js (Edge Runtime pour certaines routes)
- **Base de données** : PostgreSQL via Supabase
- **Authentification** : Supabase Auth + NextAuth.js (fallback)
- **IA** : OpenAI GPT-4o via `@ai-sdk/openai`
- **Styling** : Tailwind CSS 4
- **ORM** : Prisma (pour NextAuth uniquement) + Supabase Client pour le reste

---

## 1. Architecture Application

### 1.1 Structure des Piliers

L'application est organisée en **5 piliers fonctionnels** :

1. **Copilote IA & Transmission** ✅ (Actif)
2. **Détection & Automatisation** ✅ (Actif)
3. **Simulation Décisionnelle** ✅ (Actif)
4. **IA Émotionnelle** ⏳ (À venir)
5. **Synthèse Intelligente Client** ⏳ (À venir)

Chaque pilier est un module autonome situé dans `src/features/pillars/{pilier-id}/`.

### 1.2 Point d'Entrée Principal

**Fichier** : `src/app/page.tsx`

```typescript
- Gère l'authentification via Supabase
- Orchestre l'affichage des piliers actifs
- Gère la navigation contextuelle
- État global : pilier actif, onglet actif, threads Copilot
```

**Flux** :
1. Vérification de la session Supabase
2. Redirection vers `/login` si non authentifié
3. Rendu conditionnel selon le pilier actif
4. Affichage du Dashboard global ou du pilier spécifique

### 1.3 Navigation Contextuelle

**Fichier** : `src/features/pillars/components/ContextualNavigation.tsx`

La navigation s'adapte dynamiquement selon le pilier actif :

- **Copilote** : Discussions / Archives
- **Simulation** : Simulation / Archives
- **Détection & Automatisation** : Vue d'ensemble / Tâches / Automatisations / Analyse
- **Système** : Dashboard global / Réglages

---

## 2. Authentification

### 2.1 Supabase Auth (Principal)

**Configuration** : `src/utils/supabase/client.ts`

```typescript
- Utilise `@supabase/ssr` pour la gestion des cookies
- Client browser créé avec URL et clé anonyme Supabase
- Sessions gérées via cookies HTTP-only
```

**Flux d'authentification** :
1. Redirection vers `/login` si non authentifié
2. Page de login : `src/app/login/page.tsx`
3. Callback Supabase : `src/app/auth/callback/route.ts`
4. Stockage de la session dans les cookies

### 2.2 NextAuth.js (Fallback/Prisma)

**Configuration** : `src/server/auth/config.ts`

- Utilisé principalement pour la gestion des utilisateurs Prisma
- Provider Discord configuré (exemple)
- Adapter Prisma pour la persistance

---

## 3. Base de Données

### 3.1 Architecture Double

L'application utilise **deux systèmes de base de données** :

#### A. Supabase PostgreSQL (Principal)

Toutes les données métier sont stockées dans Supabase :
- Tables créées via SQL direct (fichiers `setup.sql` par pilier)
- Client Supabase JavaScript pour les requêtes
- Row Level Security (RLS) pour l'isolation des données

**Tables principales** (via Supabase) :
- `threads` - Conversations Copilot
- `messages` - Messages des conversations
- `documents` - Documents uploadés
- `decision_simulations` - Simulations décisionnelles
- `gray_tasks` - Tâches grises détectées
- `automations` - Automatisations créées
- `automation_executions` - Historique d'exécution
- `user_actions` - Traces d'activité utilisateur

#### B. Prisma + PostgreSQL (NextAuth uniquement)

**Schéma** : `prisma/schema.prisma`

Tables nécessaires pour NextAuth :
- `User` - Utilisateurs
- `Account` - Comptes OAuth
- `Session` - Sessions actives
- `VerificationToken` - Tokens de vérification

### 3.2 Schémas par Pilier

Chaque pilier peut avoir son propre fichier `setup.sql` :
- `src/features/pillars/copilot-transmission/` (implicite via Supabase)
- `src/features/pillars/decision-simulation/setup.sql`
- `src/features/pillars/detection-automation/setup.sql`

---

## 4. Les Piliers en Détail

### 4.1 Copilote IA & Transmission

**Emplacement** : `src/features/pillars/copilot-transmission/`

#### Fonctionnalités

1. **Base de Connaissances RAG (Retrieval Augmented Generation)**
   - Upload de multiples documents PDF pour constituer une base de connaissances
   - Recherche intelligente dans tous les documents uploadés
   - Réponses basées exclusivement sur la base de connaissances
   - Citations automatiques des sources documentaires
   - **Objectif principal** : Transmission de savoir, onboarding, facilitation des transitions

2. **Conversations Assistées par IA**
   - Chat interactif avec GPT-4o utilisant la base de connaissances
   - Génération automatique de titres de conversation
   - Historique des discussions sauvegardé
   - L'IA répond uniquement si l'information est dans les documents

3. **Gestion de Documents**
   - Upload de fichiers PDF (multiples simultanés)
   - Extraction automatique du texte (`pdf-parse-fork`)
   - Stockage dans Supabase (`documents` avec `full_text`)
   - Bibliothèque de documents consultable
   - Analyse automatique pour détection de tâches grises (bonus)

4. **Threads de Conversation**
   - Chaque conversation = un thread
   - Titre généré automatiquement par l'IA
   - Mise à jour dynamique du titre au fil de la conversation
   - Suppression des threads

#### Architecture Technique

**Hook Principal** : `hooks/useCopilot.ts`
```typescript
- Gestion des threads (CRUD)
- Gestion des messages (envoi, réception, streaming)
- Upload de documents
- Génération de titres via IA
- Transmission du userId à l'API pour récupération de la base de connaissances
```

**Composants** :
- `ChatInterface.tsx` - Interface de chat principale avec indication base de connaissances
- `DocumentLibrary.tsx` - Liste des documents
- `DocumentModal.tsx` - Détails d'un document

**API Routes** :
- `/api/chat` - Chat avec streaming + RAG (recherche dans base de connaissances)
- `/api/extract` - Extraction de texte PDF
- `/api/detect-tasks` - Détection automatique de tâches grises

#### Système RAG (Retrieval Augmented Generation)

**Fonctionnement** :
1. Lorsqu'un utilisateur pose une question, l'API `/api/chat` :
   - Récupère **tous** les documents de l'utilisateur depuis Supabase
   - Analyse la question pour extraire les mots-clés
   - Recherche les passages pertinents dans tous les documents
   - Score les documents selon la pertinence (occurrences de mots-clés, phrases complètes)
   - Extrait les passages les plus pertinents (max 5 documents, 1500 caractères chacun)
   - Injecte ces passages dans le contexte du prompt GPT-4o

2. **Algorithme de recherche** :
   - Recherche par mots-clés (mots > 2 caractères)
   - Pondération : mots longs = score x2, mots courts = score x1
   - Bonus de +50 si la requête complète apparaît
   - Bonus de +30 si les 2 premiers mots apparaissent ensemble
   - Groupement des occurrences proches (< 500 caractères)
   - Extraction de passages contextuels (200 caractères avant, 800 après)

3. **Prompt système** :
   - Instructions pour répondre uniquement basé sur les documents
   - Demande de citer les sources : `[Source: Document X: nom_du_fichier.pdf]`
   - Message d'erreur si information non trouvée
   - Ton pédagogique pour l'onboarding

#### Flux de Données

1. **Création d'une conversation** :
   ```
   Utilisateur → CopilotPillar → useCopilot.createThread()
   → Supabase.insert('threads') → Nouveau thread créé
   ```

2. **Upload d'un document** :
   ```
   Utilisateur → Upload file(s) → POST /api/extract
   → Extraction texte → Sauvegarde dans Supabase (documents)
   → POST /api/detect-tasks → Analyse IA → Détection tâches grises
   → Sauvegarde dans gray_tasks
   → Document ajouté à la base de connaissances
   ```

3. **Envoi d'un message avec RAG** :
   ```
   Utilisateur pose question → ChatInterface → useCopilot.submitMessage()
   → POST /api/chat avec userId
   ↓
   API /api/chat :
   1. Récupère TOUS les documents (Supabase.from('documents').eq('user_id'))
   2. findRelevantPassages() → Recherche et scoring
   3. Construction contexte avec passages pertinents
   4. Injection dans prompt système
   ↓
   → GPT-4o avec contexte complet (question + documents pertinents)
   → Réponse streamée basée sur la base de connaissances
   → Affichage progressif avec citations sources
   → Sauvegarde dans Supabase (messages)
   → Génération/mise à jour du titre via generateText()
   ```

---

### 4.2 Simulation Décisionnelle

**Emplacement** : `src/features/pillars/decision-simulation/`

#### Fonctionnalités

1. **Simulation de Scénarios**
   - Question stratégique posée par l'utilisateur
   - Génération de scénarios multiples par l'IA
   - Comparaison des scénarios avec métriques
   - Recommandations stratégiques

2. **Génération de Rapports**
   - Export PDF de "condensé opérationnel"
   - Résumé exécutif, scénarios analysés, recommandations
   - Bibliothèque de simulations archivées

#### Architecture Technique

**Hook Principal** : `hooks/useDecisionSimulation.ts`

**Composants** :
- `ConversationGuide.tsx` - Interface de simulation interactive
- `ScenarioCard.tsx` - Carte d'un scénario
- `ScenarioComparison.tsx` - Comparaison visuelle
- `SimulationList.tsx` - Archives des simulations

**API Routes** :
- `/api/decision-chat` - Chat pour simulation
- `/api/decision-generate` - Génération de scénarios

#### Flux de Données

1. **Création d'une simulation** :
   ```
   Utilisateur → Nouvelle simulation → useDecisionSimulation.create()
   → Supabase.insert('decision_simulations')
   → Interface conversationnelle activée
   ```

2. **Génération de scénarios** :
   ```
   Utilisateur pose question → POST /api/decision-chat
   → Analyse contextuelle par GPT-4o
   → POST /api/decision-generate
   → Génération de 3-5 scénarios avec métriques
   → Sauvegarde dans decision_simulations.scenarios (JSON)
   ```

3. **Export PDF** :
   ```
   Utilisateur clique export → jsPDF
   → Génération condensé opérationnel
   → Téléchargement fichier PDF
   ```

---

### 4.3 Détection & Automatisation

**Emplacement** : `src/features/pillars/detection-automation/`

#### Fonctionnalités

1. **Détection Automatique de Tâches Grises**
   - Analyse de documents uploadés
   - Analyse de l'historique d'actions utilisateur
   - Tracking d'activité système (macOS/Windows)
   - Calcul de scores (fréquence, répétitivité)

2. **Tracking d'Activité**
   - Script Python pour macOS et Windows
   - Collecte : fenêtres actives, applications, emails, onglets navigateur
   - Envoi périodique à `/api/track-activity`
   - Détection automatique des patterns répétitifs

3. **Gestion des Automatisations**
   - Liste des tâches détectées
   - Création d'automatisations (à venir)
   - Historique d'exécution
   - Analyse par IA pour suggestions

#### Architecture Technique

**Hook Principal** : `hooks/useAutomation.ts`

**Composants** :
- `AutomationDashboard.tsx` - Vue d'ensemble avec statistiques
- `TaskList.tsx` - Liste des tâches grises
- `AutomationList.tsx` - Liste des automatisations
- `AutomationAnalyzer.tsx` - Analyse conversationnelle par IA

**API Routes** :
- `/api/detect-tasks` - Détection depuis documents
- `/api/analyze-history` - Analyse de l'historique
- `/api/track-activity` - Réception des snapshots d'activité
- `/api/tracking-status` - Statut du tracking
- `/api/generate-tracker-script` - Génération script personnalisé

**Scripts Externes** :
- `scripts/activity-tracker.py` (macOS)
- `scripts/activity-tracker-windows.py` (Windows)

#### Flux de Données

1. **Détection depuis un document** :
   ```
   Document uploadé dans Copilot
   → POST /api/detect-tasks
   → Analyse GPT-4o du contenu
   → Extraction tâches répétitives
   → Sauvegarde dans gray_tasks
   ```

2. **Tracking d'activité** :
   ```
   Script Python lancé → Collecte toutes les 60s
   → Fenêtre active, applications, emails, onglets
   → POST /api/track-activity
   → Sauvegarde dans user_actions (action_type: 'activity_snapshot')
   → Analyse périodique pour détecter patterns
   ```

3. **Analyse de l'historique** :
   ```
   Utilisateur clique "Analyser l'historique"
   → POST /api/analyze-history
   → Récupération user_actions des 30 derniers jours
   → Récupération messages + documents
   → Analyse GPT-4o pour patterns répétitifs
   → Sauvegarde tâches détectées dans gray_tasks
   ```

#### Script de Tracking

**Génération** : `/api/generate-tracker-script`
- Script personnalisé avec `USER_ID` pré-rempli
- Installation automatique des dépendances Python
- Demande automatique de permissions système
- Format : `.command` (macOS) ou `.bat` (Windows)

**Fonctionnalités du script** :
- Vérification Python installé
- Installation `requests`, `pywin32`, `psutil` si nécessaire
- Accès System Events (macOS) ou COM automation (Windows)
- Envoi périodique vers `/api/track-activity`

---

## 5. API Routes

### 5.1 Routes Edge Runtime (Performances)

- `/api/chat` - Chat streaming avec GPT-4o (Copilot + RAG)
- `/api/agent-chat` - Chat streaming vers OpenClaw (agent d'entreprise, optionnel)
- `/api/detect-tasks` - Détection tâches grises
- `/api/track-activity` - Réception activité
- `/api/tracking-status` - Statut tracking
- `/api/generate-tracker-script` - Génération script

### 5.2 Routes Node Runtime

- `/api/extract` - Extraction PDF (nécessite Buffer Node.js)
- `/api/decision-chat` - Chat simulation
- `/api/decision-generate` - Génération scénarios
- `/api/analyze-history` - Analyse historique

### 5.3 Structure des Réponses

**Streaming** (chat) :
```typescript
streamText() → ReadableStream → Client React
```

**OpenClaw** (`/api/agent-chat`) : proxy vers le Gateway OpenClaw (`/v1/chat/completions`), transformation SSE → flux texte pour compatibilité avec le client existant. Session stable par utilisateur via `x-openclaw-session-key: orbit:<userId>`.

**JSON** (autres routes) :
```typescript
NextResponse.json({ success, data })
```

---

## 6. Intégration IA

### 6.1 OpenAI GPT-4o

**Configuration** : Variables d'environnement
- `OPENAI_API_KEY` - Clé API OpenAI

**Utilisation** :
- `streamText()` - Pour les réponses streaming (chat)
- `generateText()` - Pour les réponses complètes (titres, analyse)

### 6.2 Prompts Système

**Copilot** :
```
"Tu es OrbitAI, l'intelligence stratégique des entreprises..."
- Analyse de documents
- Conseils actionnables
- Ton professionnel et visionnaire
```

**Détection Tâches** :
```
"Tu es un expert en détection de tâches répétitives..."
- Identification tâches grises
- Scores de fréquence/répétitivité
- Analyse JSON structurée
```

---

## 7. Interface Utilisateur

### 7.1 Design System

- **Framework CSS** : Tailwind CSS 4
- **Couleurs** : Palette sombre (slate-900, slate-800)
- **Accents** : Couleurs par pilier (cyan, violet, sky, rose, emerald)
- **Typographie** : Système (Inter par défaut)
- **Icônes** : Lucide React

### 7.2 Composants Réutilisables

- `ContextualNavigation` - Navigation adaptative
- `GlobalDashboard` - Dashboard global
- Composants spécifiques par pilier

### 7.3 État Local vs Global

**État Local** (hooks) :
- `useCopilot` - État Copilot
- `useDecisionSimulation` - État Simulations
- `useAutomation` - État Automatisations

**État Global** (page.tsx) :
- Pilier actif
- Onglet actif
- Threads Copilot (pour navigation)

---

## 8. Sécurité

### 8.1 Authentification

- Sessions gérées via cookies HTTP-only
- Vérification de session sur chaque requête
- Redirection automatique si non authentifié

### 8.2 Isolation des Données

- Row Level Security (RLS) Supabase
- Filtrage par `user_id` sur toutes les requêtes
- Pas d'accès cross-user

### 8.3 Variables d'Environnement

**Client** :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

**Serveur** :
- `OPENAI_API_KEY`
- `DATABASE_URL` (Prisma)
- `SUPABASE_SERVICE_ROLE_KEY` (si nécessaire)

---

## 9. Flux de Données Typiques

### 9.1 Conversation Copilot avec RAG (Base de Connaissances)

```
1. Utilisateur upload des PDFs → Base de connaissances
   ↓
2. Extraction texte → Supabase (documents.full_text)
   ↓
3. Utilisateur clique "Nouvelle analyse"
   ↓
4. Création thread → Supabase (threads)
   ↓
5. Affichage chat + indicateur base de connaissances (X documents)
   ↓
6. Utilisateur pose question : "Comment faire X?"
   ↓
7. POST /api/chat avec userId + messages
   ↓
8. API /api/chat :
   a. Récupère TOUS les documents (Supabase.from('documents').eq('user_id'))
   b. findRelevantPassages() :
      - Extraction mots-clés de la question
      - Scoring documents (occurrences, phrases complètes)
      - Sélection top 5 documents pertinents
      - Extraction passages contextuels (max 1500 caractères)
   c. Construction contexte RAG avec passages pertinents
   ↓
9. Injection contexte dans prompt système GPT-4o
   ↓
10. GPT-4o génère réponse basée UNIQUEMENT sur documents
    ↓
11. Réponse streamée avec citations : "[Source: Document 1: fichier.pdf]"
    ↓
12. Sauvegarde message → Supabase (messages)
    ↓
13. Génération titre via generateText() (si nécessaire)
    ↓
14. Mise à jour thread.title → Supabase
```

### 9.2 Détection Automatique de Tâches

```
1. Document uploadé dans Copilot
   ↓
2. POST /api/extract → Texte extrait
   ↓
3. Document sauvegardé dans Supabase
   ↓
4. POST /api/detect-tasks automatique
   ↓
5. GPT-4o analyse contenu
   ↓
6. Extraction tâches répétitives (JSON)
   ↓
7. Sauvegarde dans gray_tasks (Supabase)
   ↓
8. Notification utilisateur (optionnel)
```

### 9.3 Tracking d'Activité

```
1. Utilisateur télécharge script personnalisé
   ↓
2. Lancement script → Installation dépendances
   ↓
3. Demande permissions système
   ↓
4. Boucle infinie (toutes les 60s) :
   a. Collecte données système
   b. POST /api/track-activity
   c. Sauvegarde dans user_actions
   ↓
5. Analyse périodique (manuel ou automatique)
   ↓
6. Détection patterns → Création tâches grises
```

---

## 10. Optimisations & Performance

### 10.1 Streaming

- Chat en streaming pour meilleure UX
- Réponses affichées progressivement
- Pas d'attente du texte complet

### 10.2 Edge Runtime

- Routes critiques en Edge Runtime
- Réduction latence pour IA
- Limitation : pas d'accès Node.js APIs

### 10.3 Caching

- NextAuth avec `cache()`
- Requêtes Supabase optimisées
- État local React pour éviter re-fetch

---

## 11. Déploiement

### 11.1 Environnement

- **Développement** : `npm run dev` (Next.js Turbo)
- **Production** : Build Next.js standard

### 11.2 Prérequis

1. **Supabase** :
   - Projet créé
   - Tables créées (via setup.sql)
   - RLS activé
   - Auth configuré

2. **OpenAI** :
   - Clé API générée
   - Quota suffisant

3. **Variables d'environnement** :
   - `.env.local` avec toutes les clés

### 11.3 Base de Données

**Migration** :
```bash
# Prisma (NextAuth uniquement)
npm run db:push

# Supabase (manuel via SQL Editor)
# Exécuter setup.sql de chaque pilier
```

### 11.4 OpenClaw (optionnel — agent d'entreprise)

Pour activer le **mode Agent** dans le pilier Copilote (raisonnement, outils, session persistante côté OpenClaw) :

1. **Déployer le Gateway OpenClaw** (port 18789 par défaut) et activer l’endpoint Chat Completions dans sa config :
   ```json5
   gateway: { http: { endpoints: { chatCompletions: { enabled: true } } } }
   ```
2. **Variables d’environnement OrbitAI** (`.env.local`) :
   - `OPENCLAW_GATEWAY_URL` : URL du Gateway (ex. `http://127.0.0.1:18789`)
   - `OPENCLAW_GATEWAY_TOKEN` : token d’auth du Gateway
   - `OPENCLAW_AGENT_ID` : (optionnel) ID de l’agent, défaut `main`
   - `NEXT_PUBLIC_OPENCLAW_ENABLED=true` : affiche le sélecteur Copilot / Agent dans l’UI
3. **Comportement** : en mode Agent, le chat appelle `/api/agent-chat`, qui proxy vers OpenClaw et convertit le flux SSE en flux texte. La session OpenClaw est dérivée de l’utilisateur : `orbit:<userId>`.

---

## 12. Roadmap Technique

### 12.1 Piliers à Développer

- **IA Émotionnelle** : Analyse des interactions
- **Synthèse Client** : Agrégation retours multi-sources

### 12.2 Fonctionnalités à Venir

- Workflow builder pour automatisations
- Intégrations externes (email, fichiers)
- Détection automatique en arrière-plan (cron)
- Système de templates d'automatisation

---

## Conclusion

OrbitAI est une plateforme modulaire et extensible, construite sur des technologies modernes (Next.js 15, React 19, Supabase, OpenAI). L'architecture par piliers permet l'ajout progressif de fonctionnalités sans impacter les modules existants. Le système est conçu pour évoluer et s'adapter aux besoins spécifiques de chaque entreprise cliente.


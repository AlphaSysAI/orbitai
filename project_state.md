# OrbitAI — État du projet

> Document de référence pour l'équipe et les assistants IA.  
> Dernière mise à jour : **juin 2025**.  
> Complète le [README.md](./README.md) (architecture) et le [DOCUMENTATION_TECHNIQUE.md](./DOCUMENTATION_TECHNIQUE.md) (détail historique, partiellement obsolète sur OpenClaw file-based).

> **Migration produit (juin 2025)** : OpenClaw retiré de l’UI. Le moteur de validation humaine est repositionné en **AI Review Engine** (onglet « Révisions IA »). Suppression technique backend/BDD en cours par phases — voir roadmap §5.

---

| Symbole | Signification |
|---------|---------------|
| ✅ | Fonctionnel en conditions réelles (avec config requise) |
| 🟡 | Partiellement implémenté ou dépend d'une config externe |
| ⏳ | Placeholder / squelette UI |
| ❌ | Abandonné ou remplacé |

---

## 1. Ce qui fonctionne déjà

### Infrastructure & auth

| Élément | Statut | Notes |
|---------|--------|-------|
| App Next.js 15 + React 19 | ✅ | `npm run dev`, build standard |
| Auth Supabase (email/mot de passe) | ✅ | `/login`, callback `/auth/callback`, session cookies |
| Isolation données (RLS Supabase) | ✅ | Filtrage `user_id` sur les tables métier |
| Schéma BDD complet | ✅ | `database/init.sql` (piliers + OpenClaw), `database/reset.sql` |
| Variables d'env validées | ✅ | `src/env.js` (partiel — Supabase via `process.env` direct) |

### Pilier Copilote IA & Transmission

| Élément | Statut | Notes |
|---------|--------|-------|
| Upload documents (PDF, DOCX, XLSX, TXT) | ✅ | `/api/extract` |
| Base de connaissances + bibliothèque | ✅ | Table `documents`, UI `DocumentLibrary` |
| Chat RAG streaming | ✅ | `/api/chat` — recherche mots-clés, top 5 docs, citations |
| Threads / messages / titres IA | ✅ | CRUD Supabase, génération titre |
| Détection tâches grises à l'upload | ✅ | `/api/detect-tasks` → `gray_tasks` |
| Feedback utilisateur sur réponses | ✅ | `/api/feedback` → `message_feedback`, apprentissage préférences |
| Mode Agent OpenClaw (optionnel) | ❌ UI retirée | Route `/api/agent-chat` legacy — backend Phase D |
| Révisions IA | ✅ | Onglet « Révisions IA » → `ValidationDashboard` ; API canonique `/api/review/*` |
| Auto-Pilot OpenClaw (UI) | ❌ UI retirée | Routes `/api/automation-policies/*` legacy — backend Phase D |

### Pilier Simulation décisionnelle

| Élément | Statut | Notes |
|---------|--------|-------|
| Création / archivage simulations | ✅ | `decision_simulations` |
| Chat conversationnel | ✅ | `/api/decision-chat` |
| Génération scénarios | ✅ | `/api/decision-generate` |
| Comparaison visuelle | ✅ | `ScenarioComparison`, `ScenarioCard` |
| Export PDF condensé | ✅ | jsPDF côté client |

### Pilier Détection & Automatisation

| Élément | Statut | Notes |
|---------|--------|-------|
| Dashboard stats | ✅ | Tâches, automatisations, taux succès |
| CRUD tâches grises | ✅ | Manuel + détection document |
| Analyse historique 30 jours | ✅ | `/api/analyze-history` |
| Script tracker activité | ✅ | Python macOS/Windows, `/api/generate-tracker-script` |
| Réception activité | ✅ | `/api/track-activity` → `user_actions` |
| Analyse conversationnelle IA | ✅ | `AutomationAnalyzer` |
| Liste automatisations (lecture / statut) | ✅ | Pause, archive, suppression |
| CRUD automatisations (API/hook) | ✅ | `useAutomation.createAutomation` — **sans UI de création** |

### Pilier Synthèse intelligente client

| Élément | Statut | Notes |
|---------|--------|-------|
| Import retours (JSON/manuel) | ✅ | `/api/client-feedback/import` |
| Sources de feedback | ✅ | CRUD `client_feedback_sources` |
| Analyse marketing IA | ✅ | `/api/client-feedback/analyze` → `marketing_analysis` |
| Dashboard + vue analyse | ✅ | Forces, faiblesses, leviers, recommandations |
| Monitoring Google Reviews | 🟡 ✅ | `/api/client-feedback/fetch-monitoring` via Google Places API (limites API) |
| Comparaison temporelle analyses | ✅ | `previous_analysis_id`, `comparison_data` |

### OpenClaw (backend)

| Élément | Statut | Notes |
|---------|--------|-------|
| Schémas Zod logs / rapports / skills | ✅ | `src/lib/openclaw/schema.ts` |
| Worker sync database-first | ✅ | `runOpenClawSync` — tables `inbox_*` → dispatch |
| Cron endpoint | ✅ | `GET|POST /api/cron/openclaw-sync` + secret |
| File validation HITL | ✅ | `ai_review_queue`, `/api/review/*`, `/api/tasks/validate` |
| Index mémoire agent | ✅ | `agent_actions_index` (insert worker + approve) |
| Auto-approbation si policy ENABLED | ✅ | Dans `processInboxAgentLogsFromDb` |
| Rapports journaliers | ✅ | `inbox_reports` → `daily_reports` |
| Skills en base | ✅ | `skill_manifests` (lecture à l'exécution) |

---

## 2. Ce qui est en cours / partiellement fait

| Domaine | État | Détail |
|---------|------|--------|
| **Exécution réelle des actions OpenClaw approuvées** | 🟡 | `executeApprovedAction()` dans `sync-worker.ts` ne fait qu'un `console.log` — merge skill + payload prévu, pas de dispatcher (webhook, script, etc.) |
| **Mémoire RAG agent dans le chat Copilot** | 🟡 | `agent_actions_index` est alimentée mais `/api/chat` ne la consulte **pas** — RAG limité aux `documents` uploadés |
| **Création d'automatisations (UI)** | 🟡 | Hook `createAutomation` OK ; bouton « Nouvelle automatisation » = `TODO` sans modal (`AutomationList.tsx`) |
| **Moteur d'exécution des automatisations** | 🟡 | Tables `automations` + `automation_executions` existent ; aucun job/cron n'exécute les automatisations configurées |
| **Monitoring multi-plateformes (client)** | 🟡 | Google Places opérationnel ; Trustpilot, Facebook, Instagram, scraping générique = stubs vides |
| **Extraction PowerPoint** | 🟡 | Message d'erreur guidant vers PDF — lib `pptx` présente dans `package.json` mais non branchée |
| **Page Réglages système** | ⏳ | Onglet accessible, contenu placeholder (« disponibles prochainement ») sauf `AutomationSettings` dans Copilot/Validation |
| **Pilier IA émotionnelle** | ⏳ | `enabled: false`, écran « bientôt disponible » — utilisé comme pilier par défaut pour le dashboard global |
| **Documentation technique** | 🟡 | `DOCUMENTATION_TECHNIQUE.md` décrit encore OpenClaw file-based et marque la synthèse client « à venir » — en décalage avec le code |
| **Auth API routes** | 🟡 | Routes review sécurisées (session) ; `/api/automation-policies/*` et `/api/track-activity` à durcir |

---

## 3. Ce qui est abandonné ou remplacé

| Élément | Remplacé par | Notes |
|---------|--------------|-------|
| **Échange fichier OpenClaw** (`data/exchange/inbox/*`, `outbox/`) | Tables `inbox_*` en base | Dossiers `.gitkeep` conservés ; `paths.ts` garde les helpers fichiers **non utilisés** par le worker actuel |
| **Logs fichier OpenClaw** (`logs/daily/`, `logs/processed/`) | `inbox_agent_logs` | `getDailyLogsDir()` etc. dans `paths.ts` — code mort côté sync |
| **Cache skills fichier** (`data/skills/`) | `skill_manifests` | Idem |
| **Migrations SQL séparées (001–005)** | `database/init.sql` unifié | Fichiers `database/migrations/` = historique uniquement |
| **setup.sql par pilier** | `database/init.sql` | Fichiers locaux (`decision-simulation/setup.sql`, etc.) — legacy |
| **NextAuth comme auth principale** | Supabase Auth | NextAuth + Prisma Discord toujours configurés (`AUTH_DISCORD_*`, `DATABASE_URL`) mais `/login` n'utilise que Supabase |
| **tRPC démo « Post »** | — | `src/app/_components/post.tsx` + router `post` — scaffold T3 non branché à l'UI |
| **`CopilotNavigation.tsx`** | `ContextualNavigation.tsx` | Composant orphelin (plus importé nulle part) |
| **README T3 Stack d'origine** | `README.md` réécrit | — |

---

## 4. Bugs connus

### Sécurité (priorité haute)

| Bug | Fichier(s) | Impact |
|-----|------------|--------|
| **API validation sans auth session** | `/api/automation-policies/*`, `/api/track-activity` | `user_id` passé en query/body sans session stricte |
| **`/api/track-activity` sans auth** | `track-activity/route.ts` | N'importe qui peut poster de l'activité pour un `userId` arbitraire |
| **Approve/reject avec service role** | `validation/approve`, `validation/reject` | Pas de vérification que l'appelant est le propriétaire de la tâche (partiellement mitigé par check `user_id` dans le body vs row) |

### Fonctionnel

| Bug / limitation | Détail |
|------------------|--------|
| **Bouton « Nouvelle automatisation » inactif** | `AutomationList.tsx` L65 — TODO, aucune action |
| **Actions approuvées non exécutées réellement** | Worker marque `executed_at` après stub — pas d'effet métier (email, webhook, etc.) |
| **RAG agent déconnecté du chat** | Actions validées indexées mais jamais injectées dans `/api/chat` |
| **Trustpilot / réseaux sociaux monitoring** | Retournent `[]` — l'UI peut afficher « succès » sans données |
| **Google Places — plafond avis** | Limitation API (~5 avis/page, max pages) — comportement attendu mais peut surprendre |
| **PPTX refusé** | Upload PowerPoint échoue avec message de conversion |
| **Double stack auth** | Prisma/NextAuth requis au build (`AUTH_DISCORD_*`) alors que l'app tourne sur Supabase — confusion setup |
| **`types.ts` commentaire obsolète** | « Le seul activé pour le moment » sur Copilot alors que 4 piliers sont `enabled: true` |
| **Lang HTML `en`** | `layout.tsx` — UI en français |

### Technique / dette

| Item | Détail |
|------|--------|
| **`generated/prisma/` versionné** | Client Prisma généré dans le repo — bruit diffs |
| **Typage Supabase contourné** | `asInsert()` dans `storage.ts` — schéma TS pas toujours aligné |
| **Échecs silencieux** | Ex. `user_actions` insert dans hooks — errors ignorées |

---

## 5. Roadmap priorisée

### P0 — Stabilisation & sécurité (avant prod)

1. **Sécuriser les API routes** — Vérifier session Supabase (ou JWT) sur toutes les routes ; ne plus faire confiance au `user_id` client seul ; réserver `service_role` au worker/cron.
2. **Finaliser l'exécution OpenClaw** — Implémenter le dispatcher dans `executeApprovedAction` (webhook, appel skill, intégration Gateway).
3. **Brancher `agent_actions_index` au RAG** — Enrichir `/api/chat` (mode Agent ou Copilot) avec la mémoire des actions validées.

### P1 — Compléter les parcours utilisateur

4. **UI création d'automatisations** — Modal/workflow builder minimal (trigger + action) branché sur `createAutomation`.
5. **Moteur d'exécution automatisations** — Cron ou worker pour `automations` actives → `automation_executions`.
6. **Réglages utilisateur** — Page settings réelle (profil, clés, préférences tracking, révocation Auto-Pilot centralisée).
7. **Monitoring client fiable** — Trustpilot API ou scraping ; feedback UI quand une source retourne 0 avis.

### P2 — Produit & UX

8. **Pilier IA émotionnelle** — Spec + MVP analyse interactions (messages, feedback).
9. **Support PPTX** — Brancher extraction via lib existante ou conversion serveur.
10. **Nettoyage codebase** — Supprimer/déprécier `paths.ts` file-based, `CopilotNavigation`, tRPC Post demo ; aligner `DOCUMENTATION_TECHNIQUE.md`.
11. **Unifier l'auth** — Supprimer NextAuth/Prisma si non utilisé, ou documenter clairement le dual setup.

### P3 — Évolutions

12. **Templates d'automatisation** — Bibliothèque de patterns détectés → automatisations suggérées.
13. **Intégrations externes** — Email, calendrier, stockage fichiers.
14. **Détection automatique en arrière-plan** — Cron analyse `user_actions` sans action manuelle.
15. **Tests E2E** — Parcours critiques (auth, RAG, validation OpenClaw, import client).

---

## 6. Matrice rapide par pilier

| Pilier | Prod-ready ? | Bloquant principal |
|--------|--------------|-------------------|
| Copilote | 🟡 Oui pour RAG docs | RAG agent non branché ; auth API |
| Décision | ✅ Oui | — |
| Automatisation | 🟡 Détection oui, exécution non | Pas de moteur exec ; bouton création cassé |
| Synthèse client | 🟡 Oui import/analyse | Monitoring hors Google vide |
| IA émotionnelle | ❌ Non | Non démarré |
| OpenClaw | 🟡 Infra oui, exec non | Dispatcher stub ; sécurité API |

---

## 7. Checklist environnement minimal

Pour valider l'état « fonctionnel » en local :

```bash
# .env requis
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # worker + APIs serveur
OPENAI_API_KEY=
DATABASE_URL=                   # Prisma (build)
AUTH_DISCORD_ID= / AUTH_DISCORD_SECRET=  # requis par env.js même si unused

# Optionnel OpenClaw Agent
OPENCLAW_GATEWAY_URL=
OPENCLAW_GATEWAY_TOKEN=
NEXT_PUBLIC_OPENCLAW_ENABLED=true

# Optionnel cron worker
CRON_SECRET=

# Optionnel monitoring Google
GOOGLE_PLACES_API_KEY=
```

```sql
-- Supabase SQL Editor
\i database/init.sql
```

---

## 8. Fichiers clés à consulter

| Besoin | Fichier |
|--------|---------|
| État des piliers (flags) | `src/features/pillars/types.ts` |
| Orchestration UI | `src/app/page.tsx` |
| Worker OpenClaw | `src/lib/openclaw/sync-worker.ts` |
| Couche data OpenClaw | `src/lib/storage.ts` |
| Schéma BDD | `database/init.sql` |
| Architecture OpenClaw | `docs/ARCHITECTURE_OPENCLAW_VALIDATION.md` |

---

*Ce document doit être mis à jour à chaque jalon significatif (nouveau pilier, fin de dette sécurité, changement architecture OpenClaw).*

# OrbitAll — Vue produit (2026)

> **Document de référence** pour onboarding, assistants IA (Claude Cowork) et décisions produit.  
> Complète l’historique technique à la racine : [`../README.md`](../README.md), [`../project_state.md`](../project_state.md).

---

## But du projet

**OrbitAll** est une plateforme SaaS multi-tenant développée par **AlphaSys**. Elle héberge des **applications métier verticales** activables par client (organisation), sur une base commune : authentification, organisations, modules, et optionnellement des **add-ons IA transverses**.

Le positionnement actuel n’est plus « 5 piliers IA » comme cœur produit, mais **des verticals métier** :

| Priorité | Module BDD | Marque UI | Statut |
|----------|------------|-----------|--------|
| **Cœur actuel** | `regiaire_core` | **Orbit Aire** | ✅ Implémenté et maintenu (le plus abouti) |
| Actif | `artisan_core` | **Orbit Artisan** | ✅ Implémenté — devis/factures IA, contacts, services |
| Actif | `hotel_core` | **Orbit Hôtel** | ✅ Implémenté — réservations, planning, tarifs, facturation, inventaire |

Un **serveur vocal IA** (ElevenLabs, `src/features/voice/`) complète les verticals (outils hôtel branchés).

Les **5 piliers** restent disponibles comme **add-ons** activables par organisation :

| Add-on | Module | Rôle |
|--------|--------|------|
| Copilote IA & Transmission | `copilot-transmission` | RAG documents, chat, révisions IA |
| Détection & Automatisation | `detection-automation` | Tâches grises, tracker activité |
| Simulation décisionnelle | `decision-simulation` | Scénarios stratégiques |
| Synthèse client | `client-synthesis` | Retours clients, analyse marketing |
| IA émotionnelle | `emotional-ai` | Placeholder (non implémenté) |

---

## Ce que fait OrbitAll aujourd’hui

### Plateforme

- Auth **Supabase** (email / mot de passe), session cookies.
- **Multi-tenant** : une organisation → plusieurs membres → modules activés à la carte.
- **Hiérarchie d'enseigne** : rôles `owner` / `admin` / `member` + `direction_france` / `directeur_region` / `chef_secteur` / `gerant` / `employe` (membres d'aire).
- **Admin plateforme** (`ORBIT_ADMIN_EMAILS`) : provisionnement clients, gestion aires, activation de modules par aire, calendrier Bison Futé.
- Dashboard global `(dashboard)/` : shell navigation + add-ons piliers + entrée Orbit Aire.

### Orbit Aire (cœur métier)

Gestion opérationnelle de **stations-service** (aires autoroutières), multi-sites :

| Domaine | Fonctionnalités livrées |
|---------|-------------------------|
| **Aires** | CRUD aires, lat/lon, zone scolaire, jours de commande, zone Bison Futé, adresse |
| **Réception** | BL (upload + IA), scan EAN mobile, stock par lots (`stock_batches`), DLC, finalisation RPC |
| **Équipe** | Passation de quart, checklist tâches, historique |
| **Verdict IA** | Synthèse signaux (météo, vacances, trafic simulé, Bison Futé, tendances N-1) → recommandation merchandising GPT-4o |
| **Réappro v2 (étape A)** | Moteur déterministe en **unités** : projection demande 7 j, multiplicateurs heuristiques, `generateReplenishmentPlan` — **pas d’UI dédiée encore** |
| **Périmés** | Alertes lots J+0 à J+3 depuis stock réel |

Routing : `/station/[aireId]/…` (Accueil, Réceptions, Équipe, Verdict).

### Orbit Artisan (`artisan_core`)

Devis et factures boostés à l'IA (`src/features/artisan/`) : gestion des contacts, catalogue de services, brouillon de devis généré depuis une demande client, édition/validation par l'artisan, factures, génération PDF. Routing : `/artisan/{contacts,devis,factures,reglages}`.

### Orbit Hôtel (`hotel_core`)

Orchestration hôtelière (`src/features/hotel/`) : réservations, planning, plans tarifaires, facturation, inventaire (avec RPC de réservation atomique). Routing : `/hotel/{reservations,planning,tarifs,factures,reglages}`. Serveur vocal IA (`src/features/voice/hotel/`) branché sur les outils hôtel.

### Add-ons (piliers)

Fonctionnels si le module est activé pour l’org — voir `project_state.md` pour le détail par pilier. Ce ne sont **pas** le focus produit principal.

### Legacy

- **OpenClaw** : retiré de l’UI ; routes `/api/agent-chat`, cron sync encore présentes en migration.
- **AI Review Engine** : `/api/review/*` (révisions humaines Copilot).

---

## Stack (résumé)

| Couche | Techno |
|--------|--------|
| Frontend | Next.js 15 App Router, React 19, Tailwind CSS 4 |
| Backend | Server Actions + API Routes Next.js |
| BDD | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth (+ NextAuth/Prisma legacy Discord) |
| IA | OpenAI GPT-4o via Vercel AI SDK |
| Validation | Zod |

---

## Démarrage local

```bash
npm install
cp .env.example .env   # renseigner Supabase, OpenAI, OWM_API_KEY, etc.
npm run dev            # http://localhost:3000
```

Variables essentielles : voir [cowork-integration.md](./cowork-integration.md).

---

## Environnement de test Orbit Aire

**Aire de référence** (données démo) :

| Champ | Valeur |
|-------|--------|
| Aire ID | `7ec3c50b-4893-4904-90d2-56e0ab04532a` |
| Nom | Aire Arzens SUD |
| Org ID | `bba39426-6f78-4750-a77a-f5c0c991a878` |

Seed : `database/seeds/017_regiaire_arzens_demo.sql` (après migrations 020+ et 027).

URLs directes :

- Dashboard : `/station/7ec3c50b-4893-4904-90d2-56e0ab04532a/dashboard`
- Verdict : `/station/7ec3c50b-4893-4904-90d2-56e0ab04532a/verdict`
- Réceptions : `/station/7ec3c50b-4893-4904-90d2-56e0ab04532a/deliveries`

Constantes code : `src/features/regiaire/lib/demo-aire.ts`.

---

## Documentation dans ce dossier

| Fichier | Contenu |
|---------|---------|
| [architecture.md](./architecture.md) | Architecture technique complète |
| [regiaire-reference.md](./regiaire-reference.md) | Orbit Aire : routes, actions, BDD, seeds |
| [orbit-voice-elevenlabs.md](./orbit-voice-elevenlabs.md) | Serveur vocal IA (ElevenLabs) |
| [cowork-integration.md](./cowork-integration.md) | Notes pour Claude Cowork et assistants |

---

## Roadmap produit (orientation)

Les trois verticals sont désormais **implémentés** ; la roadmap porte sur leur approfondissement :

1. **Orbit Aire** — Verdict v2 étape B (UI réappro + narration), flux POS réels, suivi commandes.
2. **Orbit Artisan** — enrichissement devis/chantiers/planning, entrée vocale de la demande client.
3. **Orbit Hôtel** — serveur vocal IA de bout en bout (réservation → commande en chambre).

Les add-ons piliers restent maintenus mais ne pilotent plus la roadmap.

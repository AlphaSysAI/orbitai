# CLAUDE.md

Contexte pour Claude Code / assistants IA travaillant sur ce dépôt. Lu automatiquement au démarrage d'une session.

> Documentation produit détaillée : dossier [`Claude/`](./Claude/). Ce fichier en est le résumé opérationnel — en cas de divergence, le code fait foi.

---

## Le projet en une phrase

**OrbitAll** (éditeur AlphaSys / OrbitSys) est une plateforme SaaS **multi-tenant** hébergeant des **applications métier verticales** activables par organisation, sur une base commune (auth, organisations, modules), plus des **add-ons IA transverses**.

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| Backend | Server Actions (prioritaire) + API Routes Next.js |
| BDD | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth (email/mot de passe) ; NextAuth + Prisma = **legacy Discord** uniquement |
| IA | OpenAI (GPT-4o) via Vercel AI SDK (`ai` v6) ; voix via ElevenLabs |
| Validation | Zod |
| Déploiement | Vercel ; migrations Supabase appliquées **manuellement** (SQL Editor) |

## Commandes

```bash
npm run dev          # dev (Turbo), http://localhost:3000
npm run check        # next lint + tsc --noEmit  <-- à lancer après toute modif
npm run build        # build prod
npm run typecheck    # tsc --noEmit seul
npm run format:write # prettier
```

`prisma` ne sert **que** pour l'auth legacy — le métier ne passe pas par Prisma.

---

## Modules activables (`src/lib/organizations/`)

Source de vérité : `types.ts` (`ORG_MODULE_NAMES`) + `module-catalog.ts`.

**Verticals métier (implémentés)** :

| Module BDD | Marque UI | Périmètre |
|------------|-----------|-----------|
| `regiaire_core` | **Orbit Aire** | Stations-service : réception BL, stock par lots, équipes, Verdict IA, réappro |
| `artisan_core` | **Orbit Artisan** | Devis / factures IA, contacts, services, génération PDF |
| `hotel_core` | **Orbit Hôtel** | Réservations, planning, tarifs, facturation, inventaire |

> ⚠️ **Orbit Artisan et Orbit Hôtel SONT implémentés** (code, routes, migrations). Ne pas se fier à d'anciennes docs qui les disent « catalogue/branding seulement ».

**Add-ons IA transverses** : `knowledge_base`, `copilot-transmission` (RAG/chat), `detection-automation`, `decision-simulation`, `client-synthesis`. (`emotional-ai` existe dans `pillars/` mais n'est pas au catalogue.)

Activation runtime : RPC Supabase `org_has_module`, `get_my_enabled_modules`.

## Rôles (`organization_members.role`)

`owner`, `admin`, `member` + hiérarchie d'enseigne : `direction_france`, `directeur_region`, `chef_secteur`, `gerant`, et `employe` (membres d'aire). Admin plateforme = emails dans `ORBIT_ADMIN_EMAILS` → `/admin`.

---

## Structure

```
src/
├── app/
│   ├── (dashboard)/            # shell + navigation
│   │   ├── station/[aireId]/   # Orbit Aire (dashboard, deliveries, equipe, verdict)
│   │   ├── artisan/            # Orbit Artisan (contacts, devis, factures, reglages)
│   │   ├── hotel/              # Orbit Hôtel (reservations, planning, tarifs, factures)
│   │   ├── region/chef/        # vue hiérarchie enseigne
│   │   └── admin/              # provisioning : bison-fute, orbit-aire, orbit-artisan, orbit-hotel
│   └── api/                    # REST (add-ons, admin, voice, cron, inbound BL, trpc)
├── features/
│   ├── regiaire/               # cœur Orbit Aire (aires, reception, shift, verdict, team,
│   │                           #   inbound, direction, gerant, region, sector-manager)
│   ├── artisan/                # devis, factures, contacts, services
│   ├── hotel/                  # reservations, planning, rates, billing, inventory
│   ├── voice/                  # serveur vocal IA (ElevenLabs), outils hôtel
│   ├── organization/           # membres, profil, fournisseurs
│   ├── admin/                  # provisioning, Bison Futé admin
│   └── pillars/                # add-ons IA transverses
├── lib/organizations/          # modules, rôles, navigation, branding SaaS
├── server/auth/                # supabase-server.ts, config NextAuth legacy
└── types/database.types.ts     # types tables Supabase

database/
├── init.sql                    # schéma canonique idempotent
├── migrations/                 # 001–045 (voir plus bas)
└── seeds/                      # 013–017 (017 = aire de démo Arzens)
```

## Pattern serveur métier (Orbit Aire)

Toute action métier est scopée **org + aire** :

```typescript
import { requireRegiaireContext } from "@/lib/regiaire/require-context";

export async function myAction(aireId: string) {
  const ctx = await requireRegiaireContext(aireId);
  // ctx.db (écritures Supabase RLS user), ctx.organizationId, ctx.aireId, ctx.userId
}
```

Admin org (pas aire) : `requireOrgAdminContext()` (`src/lib/organizations/org-context.ts`).
Admin plateforme (Bison Futé, provisioning) : `service_role` — **jamais** depuis un contexte utilisateur/station.

## Base de données

- **Source de vérité schéma** : `database/init.sql` + `migrations/001→045`. Toute modif schéma = nouvelle migration `0xx_*.sql` **+** mise à jour `init.sql` **+** `src/types/database.types.ts`.
- Migrations appliquées manuellement (Supabase SQL Editor), pas de CI Prisma pour le métier.
- Jalons récents : `028` inbound email BL · `029–032` hiérarchie org / gérant / rôles / équipe d'aire · `033` durcissement RLS · `034` cache secteur · `035`,`045` Artisan · `036` modules par aire · `037–043` Hôtel · `044` voice IA.
- Storage : bucket `regiaire-bl` (PDF des bons de livraison, path org-scopé).

---

## Conventions

- **Server Actions** : `"use server"` en tête, retour `{ success, data?, error? }`.
- **Imports server-only** : `import "server-only"` dans les modules de signaux / accès données.
- **Dates** : ISO `YYYY-MM-DD`, timezone Paris pour « aujourd'hui » (`todayParisIso`).
- **Zod strict** sur les signaux (ex. `forecast: null` si météo indispo, jamais `undefined`).
- **Commits** : messages en français, impératif, focalisés sur le « pourquoi ».
- Après toute modif : `npm run check`.

## Variables d'environnement (voir `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (tout) · `SUPABASE_SERVICE_ROLE_KEY` (admin/seeds, jamais côté client) · `OPENAI_API_KEY` (IA) · `OWM_API_KEY` (météo Verdict, optionnel) · `ORBIT_ADMIN_EMAILS` (accès `/admin`) · `AUTH_SECRET` (NextAuth legacy).

## Aire de démo (Orbit Aire)

```
Aire ID : 7ec3c50b-4893-4904-90d2-56e0ab04532a  (Aire Arzens SUD)
Org  ID : bba39426-6f78-4750-a77a-f5c0c991a878
```

Prérequis test : migrations à jour + seed `017_regiaire_arzens_demo.sql`. Constantes : `src/features/regiaire/lib/demo-aire.ts`.

---

## Docs détaillées (`Claude/`)

| Fichier | Contenu | Note |
|---------|---------|------|
| `Claude/README.md` | Vue produit | à jour ⚠️ partiellement (verticals) |
| `Claude/architecture.md` | Architecture technique | ⚠️ antérieure aux verticals/voice/hiérarchie |
| `Claude/regiaire-reference.md` | Référence Orbit Aire | fiable pour le cœur |
| `Claude/cowork-integration.md` | Notes assistants IA | ⚠️ dit Artisan/Hôtel « non implémentés » (faux) |
| `Claude/orbit-voice-elevenlabs.md` | Serveur vocal IA | — |

`README.md` et `DOCUMENTATION_TECHNIQUE.md` à la racine sont un historique long (centré OpenClaw, legacy) — à traiter comme obsolètes.

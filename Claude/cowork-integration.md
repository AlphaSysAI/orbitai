# Notes d’intégration — Claude Cowork

> Contexte condensé pour travailler efficacement sur ce dépôt avec Claude Cowork ou tout assistant IA.

---

## 1. Lecture prioritaire (ordre suggéré)

1. [README.md](./README.md) — vision produit 2026
2. [architecture.md](./architecture.md) — stack et patterns
3. [regiaire-reference.md](./regiaire-reference.md) — détail RégiAire
4. `src/lib/regiaire/require-context.ts` — gate d’accès métier
5. `src/lib/organizations/module-catalog.ts` — modules activables

**Ignorer en premier** : `README.md` racine (645 lignes, historique OpenClaw / piliers centrés).

---

## 2. Règles produit à respecter

| ✅ Faire | ❌ Ne pas supposer |
|----------|-------------------|
| RégiAire = cœur métier | Les 5 piliers ne sont plus la roadmap principale |
| Verticals : RégiAire → Artisan → NodAll | `artisan_core` / `hotel_core` n’ont pas de code métier encore |
| Multi-aire : toujours passer `aireId` | Pas de données globales org sans `aire_id` pour stock/ventes |
| Écritures RégiAire via `ctx.db` | Pas de service_role côté station utilisateur |
| Zod strict sur signaux | `forecast: null` si météo indispo (pas `undefined`) |

---

## 3. Arborescence utile

```
src/features/regiaire/     ← 90 % du travail métier actuel
src/features/organization/ ← membres, profil, fournisseurs
src/features/admin/        ← provisioning, Bison Futé admin
src/features/pillars/      ← add-ons (touch with care)
database/
  init.sql                 ← schéma canonique
  migrations/              ← 001–027
  seeds/                   ← 013–017 (017 = Arzens)
Claude/                    ← cette doc
```

---

## 4. Variables d’environnement

Fichier modèle : `.env.example`

| Variable | Obligatoire pour | Notes |
|----------|------------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Tout | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tout | |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin / seeds scripts | Jamais côté client |
| `OPENAI_API_KEY` | Verdict, BL IA, piliers | Via AI SDK |
| `OWM_API_KEY` | Météo Verdict + header | Verdict fonctionne sans, signal indispo |
| `ORBIT_ADMIN_EMAILS` | `/admin` | CSV emails |
| `AUTH_SECRET` | NextAuth legacy | |

---

## 5. Commandes

```bash
npm run dev          # dev Turbo
npm run check        # lint + tsc
npm run build        # build prod
```

Typecheck ciblé après modifs Verdict :

```bash
npx tsc --noEmit 2>&1 | rg "regiaire|verdict"
```

---

## 6. Tests manuels RégiAire

### Prérequis BDD

- Migrations **027** appliquées
- Seed **017** exécuté

### Compte

Membre de l’org `bba39426-6f78-4750-a77a-f5c0c991a878` avec `regiaire_core` activé.

### URLs

```
/station/7ec3c50b-4893-4904-90d2-56e0ab04532a/dashboard
/station/7ec3c50b-4893-4904-90d2-56e0ab04532a/verdict
/station/7ec3c50b-4893-4904-90d2-56e0ab04532a/deliveries
```

### Actions serveur (depuis code ou route dev)

- `generateVerdict(aireId)`
- `generateReplenishmentPlan(aireId)`
- `getExpiringStock(aireId)`

Route dev existante : `/api/dev/verdict` (vérifier avant usage).

---

## 7. Pièges connus (bugs déjà rencontrés)

| Problème | Cause | Fix |
|----------|-------|-----|
| Zod `forecast` required | `getWeather` retournait `{ available: false }` sans `forecast: null` | Toujours `forecast: null` + `reason` |
| Seed 017 échoue sur stock | `stock_batches.delivery_id` NOT NULL | Livraison `completed` seed avant insert lots |
| `SchoolZoneSchema` duplicate | Doublon dans `schemas.ts` | Une seule déclaration |
| Plan réappro vide | Pas de `sales_history` sur l’aire | Exécuter seed 017 |
| Bison Futé indispo | `bison_fute_zone` null sur aire | Seed 017 ou UPDATE zone 5 |
| Verdict sans météo | `OWM_API_KEY` absente | Normal — verdict génère quand même |

---

## 8. Conventions de code

- **Server Actions** : `"use server"` en tête, retour `{ success, data?, error? }`
- **Imports server-only** : `import "server-only"` dans modules signaux / access
- **Dates** : ISO `YYYY-MM-DD`, timezone Paris pour « aujourd’hui » (`todayParisIso`)
- **Commits** : messages en français, impératif, focus « why »
- **PR RégiAire récente** : branche `feature/verdict-v2-replenishment-step-a`, PR #15

---

## 9. Ce qui n’est PAS implémenté (ne pas inventer)

- UI réappro Verdict v2 étape B
- Suivi commandes fournisseur (réappro v1 ignore commandes passées)
- POS / caisse → `sales_history` réel
- Modules **Artisan** et **NodAll** (seulement entrées catalogue + branding)
- Prix, marge, CA

---

## 10. Branches et déploiement

- Repo : `AlphaSysAI/orbitai` sur GitHub
- Hébergement visé : Vercel
- Migrations Supabase : appliquées manuellement (SQL Editor) — pas de Prisma pour le métier Supabase

---

## 11. Glossaire

| Terme | Signification |
|-------|----------------|
| **Aire** | Station-service (site physique), entité `aires` |
| **Org** | Client SaaS, `organizations` |
| **Verdict** | Recommandation IA journalière merchandising + affluence |
| **BL** | Bon de livraison |
| **DLC** | Date limite de consommation |
| **Bison Futé** | Signal trafic autoroute (vert/orange/rouge/noir) |
| **Add-on** | Pilier IA transverse (Copilot, etc.) |
| **NodAll** | Nom produit vertical hôtel (`hotel_core`) |

---

## 12. Fichiers à modifier selon la tâche

| Tâche | Fichiers |
|-------|----------|
| Nouvelle action RégiAire | `actions/*.ts` + `requireRegiaireContext` |
| Schéma BDD | `database/migrations/0xx_*.sql` + `init.sql` + `database.types.ts` |
| Seed démo | `database/seeds/017_*.sql` |
| Signaux Verdict | `verdict/signals/`, `verdict/schemas.ts` |
| UI station | `src/app/(dashboard)/station/`, `regiaire/components/` |
| Admin client | `src/features/admin/`, `/api/admin/clients` |
| Module activation | `module-catalog.ts`, provisioning `provision-client.ts` |

---

## 13. Contact produit (contexte)

- Éditeur : AlphaSys / OrbitAI
- Vertical actif : **RégiAire** (stations-service, ex. client type Dyneff)
- Prochains verticals : **Artisan**, **NodAll** (hôtel)

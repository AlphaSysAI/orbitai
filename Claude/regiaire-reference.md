# RégiAire — Référence technique

> Module `regiaire_core` — cœur métier OrbitAI. Voir aussi [architecture.md](./architecture.md).

---

## Contexte serveur obligatoire

```typescript
import { requireRegiaireContext } from "@/lib/regiaire/require-context";

export async function myAction(aireId: string) {
  const ctx = await requireRegiaireContext(aireId);
  // ctx.db — écritures Supabase (RLS user)
  // ctx.organizationId, ctx.aireId, ctx.userId
}
```

Erreurs typées : `RegiaireContextError` (`unauthenticated`, `module_disabled`, `invalid_aire`, …).

Admin org (pas aire) : `requireOrgAdminContext()` dans `src/lib/organizations/org-context.ts`.

---

## Routes UI

| Chemin | Page |
|--------|------|
| `/station` | Liste aires ou redirect si une seule |
| `/station/[aireId]/dashboard` | Accueil aire, périmés, liens |
| `/station/[aireId]/deliveries` | Liste livraisons |
| `/station/[aireId]/deliveries/new` | Nouvelle réception |
| `/station/[aireId]/deliveries/[id]/scan` | Scan EAN |
| `/station/[aireId]/equipe` | Passation de quart |
| `/station/[aireId]/equipe/config` | Config tâches |
| `/station/[aireId]/equipe/historique` | Historique |
| `/station/[aireId]/verdict` | Verdict IA |

Layout station : `src/app/(dashboard)/station/[aireId]/layout.tsx` — header météo via `header-snapshot.ts`.

---

## Server Actions principales

### Réception (`src/features/regiaire/reception/actions/`)

| Action | Rôle |
|--------|------|
| `analyzeBL` | Upload BL + extraction IA → lignes draft |
| `confirmReview` | Valide lignes BL avant scan |
| `recordScan` | Incrémente scan (RPC atomique) |
| `bindEanToLine` | Lie EAN à ligne sans code |
| `addUnexpectedLine` | Produit hors BL |
| `finalizeDelivery` | Finalise → stock_batches |
| `scanCorrection` / undo | Corrections post-scan |

Upsert produit : `upsertProductForLine` pose `products.supplier_id` depuis la livraison (migration 027).

### Verdict (`src/features/regiaire/verdict/actions/`)

| Action | Rôle |
|--------|------|
| `generateVerdict` | Verdict IA du jour (cache `verdict_runs`) |
| `regenerateVerdict` | Supprime cache + regénère |
| `getExpiringStock` | Lots périmés / proches |
| `getStationSettingsAction` | Paramètres aire |
| `generateReplenishmentPlan` | Plan réappro structuré (étape A, pas d’UI) |

### Équipe (`src/features/regiaire/shift/actions/`)

| Action | Rôle |
|--------|------|
| `toggleTaskCheck` | Coche tâche quart |
| `closeShift` | Clôture + consignes |
| `listShiftTasks`, `listClosures` | Lecture |

### Aires (`src/features/regiaire/aires/actions/`)

| Action | Rôle |
|--------|------|
| `listAiresForOrg` | Liste pour nav |
| `createAire`, `updateAire`, `deleteAire` | CRUD (admin org) |

---

## Données : réel vs simulé

| Table | Par aire | Source |
|-------|----------|--------|
| `stock_batches` | ✅ | **Réel** — réceptions finalisées |
| `deliveries`, `delivery_lines` | ✅ | **Réel** |
| `products`, `suppliers` | Org | **Réel** (+ seed démo) |
| `sales_history` | ✅ | **Seed démo** — pas de POS branché |
| `traffic_signals` | ✅ | **Seed démo** |
| `verdict_runs` | ✅ | Cache IA généré |
| `bison_fute_forecast` | Global zone | Admin plateforme |

Pas de CA / prix de vente en v1.

---

## Signaux Verdict

| Fichier | Signal |
|---------|--------|
| `signals/weather.ts` | OWM J0→J+6, timeout 3s |
| `signals/school-holidays.ts` | API Éducation, zone A/B/C de l’aire |
| `signals/traffic.ts` | `traffic_signals.footfall_index` |
| `signals/bison-fute.ts` | Zone `aires.bison_fute_zone` + table forecast |
| `trends/build-trend-windows.ts` | 15j vs N-1 aligné ISO semaine |

Paramètres aire : `station-settings-access.ts` ← table `aires` (lat, lon, school_zone, order_days).

---

## Réappro v2 — multiplicateurs v1

Fichier : `replenishment/demand-multipliers.ts`

| Règle | Condition | Facteur |
|-------|-----------|---------|
| Chaleur boissons | tempMax ≥ 28 °C, cat. Boissons | ×1,6 |
| Glaces | tempMax ≥ 25 °C, cat. Glaces | ×2,0 |
| Bison Futé | niveau rouge/noir | ×1,8 (toutes cat.) |
| Vacances | `isOnHoliday` | ×1,3 (toutes cat.) |

Formule : `demande[jour] = baseline(jour_semaine) × ∏ multiplicateurs`.

Sortie action : `{ product, category, currentStock, projectedDemand, suggestedOrderQty, orderByDate, supplier, reason[] }`.

---

## Seeds et aire de test

**Aire de référence** :

```
ID   : 7ec3c50b-4893-4904-90d2-56e0ab04532a
Org  : bba39426-6f78-4750-a77a-f5c0c991a878
Nom  : Aire Arzens SUD
```

| Seed | Contenu |
|------|---------|
| `013_regiaire_demo.sql` | Produits, fournisseur, livraisons (première org regiaire) |
| `014_regiaire_verdict_demo.sql` | Trafic + ventes ~400j (legacy Carcassonne) |
| `015_regiaire_multi_aires_demo.sql` | 3 aires démo |
| `016_regiaire_bison_fute_demo.sql` | Zones + prévisions été |
| **`017_regiaire_arzens_demo.sql`** | **Cible Arzens fixe** — trafic, ventes, stock, réceptions |

Ordre d’exécution Supabase SQL Editor :

1. Migrations à jour (jusqu’à **027**)
2. `017_regiaire_arzens_demo.sql`

**Piège seed 017** : `stock_batches` exige `delivery_id` — le seed crée une livraison `completed` avec `bl_file_path = 'seed:017_arzens_stock'`.

Constantes TS : `src/features/regiaire/lib/demo-aire.ts`.

---

## Settings org — fournisseurs

- UI : `OrganizationSettingsPanel` → section Fournisseurs
- Actions : `getOrgSuppliers`, `updateSupplierLeadTime` (`org-suppliers.ts`)
- Champ BDD : `suppliers.lead_time_days` (jours, pour `orderByDate` réappro)

---

## Admin plateforme

| Route | Rôle |
|-------|------|
| `/admin` | CRUD clients, modules, aires |
| `/admin/bison-fute` | Calendrier Bison Futé (import CSV, édition jour) |

Écritures forecast : `bison-fute/persist-forecast.ts` (service_role).

Guard : emails dans `ORBIT_ADMIN_EMAILS`.

---

## Storage BL

- Bucket : `regiaire-bl`
- Constantes : `src/lib/regiaire/constants.ts` (`REGIAIRE_BL_BUCKET`, `buildBlStoragePath`)

---

## RPC PostgreSQL

| Fonction | Usage |
|----------|--------|
| `regiaire_increment_scan` | Scan atomique + décrement |
| `regiaire_finalize_delivery` | Finalisation transactionnelle → stock |

Définies dans migrations 014–015 et mises à jour multi-aires (022).

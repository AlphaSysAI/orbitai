# Architecture OpenClaw – Séparation Exécution / Mémoire et Validation Humaine

## Principes

- **Exécution** : OpenClaw produit des logs (append-only) dans un répertoire dédié.
- **Mémoire** : OrbitAI stocke uniquement les actions **validées** (ou exécutées sans validation) pour le RAG.
- **Validation** : Les actions `pending_validation` passent par une file `ValidationQueue` ; le RAG n’indexe jamais une action non validée.

---

## 1. Schéma JSON strict des logs OpenClaw

Chaque événement logué par OpenClaw doit respecter le schéma suivant (conformité via TypeScript Zod ou JSON Schema).

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `event_id` | string (UUID) | Oui | Identifiant unique de l’événement |
| `timestamp` | string (ISO 8601) | Oui | Date/heure de l’événement |
| `action` | string | Oui | Type d’action (ex. `tool_call`, `send_email`, `create_task`) |
| `status` | enum | Oui | `pending_validation` \| `executed` \| `failed` |
| `payload` | object | Oui | Données spécifiques à l’action (structure libre mais typée par action) |
| `rationale` | string | Oui | Justification de l’agent pour cette action |
| `human_input_required` | boolean | Oui | Indique si une validation humaine est requise |

**Exemple de log valide :**

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-02-28T14:30:00.000Z",
  "action": "send_email",
  "status": "pending_validation",
  "payload": { "to": "user@example.com", "subject": "Rapport", "body": "..." },
  "rationale": "L'utilisateur a demandé l'envoi du rapport hebdomadaire.",
  "human_input_required": true
}
```

Les fichiers dans `/logs/daily/` peuvent être en **JSONL** (une ligne = un objet JSON) ou **JSON** (un tableau d’événements). Le worker accepte les deux formats.

---

## 2. Structure de dossiers proposée

```
orbit-ai/
├── docs/
│   └── ARCHITECTURE_OPENCLAW_VALIDATION.md    # Ce document
├── database/
│   └── init.sql                               # Existant + migration OpenClaw
├── logs/                                      # Répertoire des logs OpenClaw (côté serveur / volume)
│   ├── daily/                                 # Entrée : fichiers à traiter par le worker
│   └── processed/                             # Sortie : fichiers déplacés après traitement
├── src/
│   ├── app/api/
│   │   ├── agent-chat/                        # Existant (proxy OpenClaw)
│   │   └── validation/                        # Nouveaux endpoints Human-in-the-Loop
│   │       ├── queue/route.ts                 # GET liste des tâches en attente
│   │       ├── approve/route.ts               # POST approuver (event_id)
│   │       ├── reject/route.ts                # POST rejeter (event_id)
│   │       └── status/route.ts                # GET statut d’une tâche (polling OpenClaw)
│   ├── lib/
│   │   └── openclaw/                          # Module dédié OpenClaw
│   │       ├── schema.ts                      # Schéma Zod + types TS des logs
│   │       ├── sync-worker.ts                 # Logique du worker (parse, dispatch, archive)
│   │       └── paths.ts                      # Chemins logs/daily, logs/processed
│   ├── jobs/                                  # Ou scripts/ selon convention projet
│   │   └── openclaw-sync.ts                   # Point d’entrée cron (appelle sync-worker)
│   └── features/pillars/
│       └── ...                                # Existant
└── ...
```

**Remarques :**

- `logs/` peut être un volume monté ou un chemin absolu configuré par variable d’environnement (`OPENCLAW_LOGS_DIR`).
- Le worker (cron) s’exécute côté serveur Node (pas Edge) pour accès fichiers + Supabase.

---

## 3. Schéma de base de données (PostgreSQL / Supabase)

### 3.1 Table `validation_queue`

Stocke les actions en attente de validation humaine. Une ligne = un événement logué avec `status: pending_validation`.

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | TEXT (PK) | DEFAULT gen_random_uuid() | Identifiant interne OrbitAI |
| `event_id` | TEXT | UNIQUE, NOT NULL | `event_id` du log OpenClaw |
| `user_id` | UUID | FK auth.users, NOT NULL | Utilisateur propriétaire (dérivé de session/key) |
| `action` | TEXT | NOT NULL | Type d’action |
| `payload` | JSONB | NOT NULL | Copie du champ `payload` du log |
| `rationale` | TEXT | NOT NULL | Copie du champ `rationale` |
| `human_input_required` | BOOLEAN | NOT NULL | Copie du log |
| `status` | TEXT | CHECK IN ('pending', 'approved', 'rejected') | État de la validation |
| `raw_log_line` | JSONB | | Log complet (append-only, audit) |
| `validated_at` | TIMESTAMPTZ | | Date de décision (approbation/rejet) |
| `validated_by` | UUID | FK auth.users | Qui a validé (optionnel) |
| `rejection_reason` | TEXT | | Si rejet, raison optionnelle |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Insertion dans la file |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Dernière mise à jour |

Index recommandés : `(user_id, status)`, `(event_id)`, `(status)` pour les requêtes “en attente”.

### 3.2 Table `agent_actions_index` (mémoire RAG)

Stocke **uniquement** les actions déjà exécutées ou approuvées, pour alimenter le moteur RAG (recherche par `full_text` ou champs dédiés). Le RAG ne lit que cette table (ou des vues basées dessus).

| Colonne | Type | Contraintes | Description |
|---------|------|-------------|-------------|
| `id` | TEXT (PK) | DEFAULT gen_random_uuid() | Identifiant interne |
| `event_id` | TEXT | UNIQUE, NOT NULL | `event_id` du log source |
| `user_id` | UUID | FK auth.users, NOT NULL | Propriétaire |
| `action` | TEXT | NOT NULL | Type d’action |
| `status` | TEXT | NOT NULL | `executed` ou reflétant une validation réussie |
| `payload` | JSONB | NOT NULL | Données de l’action |
| `rationale` | TEXT | NOT NULL | Justification (indexable pour RAG) |
| `full_text` | TEXT | | Concatenation action + rationale + payload (pour recherche RAG) |
| `source_file` | TEXT | | Fichier log d’origine (audit) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Date d’indexation |

Index : `(user_id)`, `(created_at)`, et index full-text sur `full_text` si besoin.

### 3.3 RLS (Row Level Security)

- `validation_queue` : politiques SELECT/UPDATE par `user_id` (auth.uid()).
- `agent_actions_index` : politique SELECT (et INSERT par le worker avec service role ou contexte serveur) par `user_id`.

---

## 4. Flux de données

1. **OpenClaw** écrit des logs (append-only) dans `logs/daily/` (fichiers JSONL ou JSON).
2. **Worker (cron)** :
   - Scanne `logs/daily/`,
   - Parse chaque fichier selon le schéma JSON strict,
   - Pour chaque événement `status === 'executed'` → insert dans `agent_actions_index` (et construction de `full_text` pour le RAG),
   - Pour chaque événement `status === 'pending_validation'` → insert dans `validation_queue` (status `pending`),
   - Déplace les fichiers traités vers `logs/processed/`.
3. **Humain** : via l’UI OrbitAI (ou API), consulte la file, approuve ou rejette.
4. **API Approve** : met à jour `validation_queue` (status `approved`), puis insère dans `agent_actions_index` pour que le RAG puisse indexer.
5. **API Reject** : met à jour `validation_queue` (status `rejected`), pas d’insert dans `agent_actions_index`.
6. **OpenClaw** : peut interroger `GET /api/review/status?event_id=...` (ou `review_id`) pour savoir si une tâche a été validée (polling). Les routes `/api/validation/*` sont supprimées (Phase D.1).

---

## 5. Bonnes pratiques retenues

- **Séparation stricte** : le RAG ne lit que `agent_actions_index` (et éventuellement `documents` existant) ; aucune action non validée n’y entre.
- **Logs immuables** : les fichiers dans `daily/` sont déplacés, pas modifiés ; `raw_log_line` dans `validation_queue` est en lecture seule après insert.
- **Typage** : schéma Zod partagé pour les logs, types TypeScript dérivés pour tout le code (worker, API, UI).
- **Cron** : un seul job “openclaw-sync” qui appelle la logique dans `lib/openclaw/sync-worker.ts` Déclenchement : GET/POST /api/cron/openclaw-sync avec Authorization: Bearer <CRON_SECRET>. Env : OPENCLAW_LOGS_DIR, OPENCLAW_DEFAULT_USER_ID, SUPABASE_SERVICE_ROLE_KEY.

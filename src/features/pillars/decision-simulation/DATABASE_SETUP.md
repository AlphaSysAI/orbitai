# Configuration de la base de données pour Simulation Décisionnelle

## Installation

1. Ouvrez votre console Supabase (https://supabase.com/dashboard)
2. Allez dans l'onglet **SQL Editor**
3. Copiez-collez le contenu du fichier **`setup.sql`** (dans le même dossier que ce fichier)
4. Cliquez sur **Run** pour exécuter la requête

**⚠️ Important :** Le fichier `setup.sql` contient uniquement le SQL pur, sans commentaires markdown.

## Structure des données JSON

### `context` (JSONB)
```json
{
  "question": "Devrais-je lancer ce nouveau produit ?",
  "decisionType": "strategic",
  "options": ["Lancer", "Reporter", "Annuler"],
  "constraints": ["Budget limité", "Timeline serrée"],
  "objectives": ["Croissance", "Rentabilité"],
  "stakeholders": ["CEO", "Marketing", "Finance"],
  "timeline": "6 mois",
  "budget": "500k€",
  "documents": [...],
  "historicalData": "...",
  "marketContext": "...",
  "currentMetrics": {...}
}
```

### `conversation` (JSONB)
Array de messages :
```json
[
  {
    "id": "1",
    "role": "assistant",
    "content": "...",
    "timestamp": "2024-01-01T00:00:00Z"
  },
  {
    "id": "2",
    "role": "user",
    "content": "...",
    "timestamp": "2024-01-01T00:01:00Z"
  }
]
```

### `scenarios` (JSONB)
Array de scénarios avec la structure définie dans `types.ts`


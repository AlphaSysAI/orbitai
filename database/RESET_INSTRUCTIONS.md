# Instructions de réinitialisation de la base de données

## ⚠️ Attention

Cette procédure va **supprimer toutes les données OrbitAll** de votre base de données. Les tables système Supabase (authentification, etc.) ne seront **PAS** affectées.

## Étapes

### 1. Nettoyer la base de données

Exécutez le script `reset.sql` dans votre console SQL Supabase :

```sql
-- Fichier : database/reset.sql
```

Ce script va :
- Supprimer toutes les tables OrbitAll
- Supprimer toutes les fonctions et triggers
- Préparer la base pour une réinitialisation complète

### 2. Réinitialiser la base

Exécutez ensuite le script `init.sql` :

```sql
-- Fichier : database/init.sql
```

Ce script va :
- Recréer toutes les tables avec la structure correcte
- Recréer tous les index et politiques RLS
- Initialiser toutes les fonctions et triggers

## Résultat

Vous aurez une base de données OrbitAll complètement propre et fonctionnelle, sans aucune donnée existante.

## Note importante

- ✅ Vos utilisateurs (auth.users) ne seront **PAS** supprimés
- ✅ Votre configuration Supabase ne sera **PAS** affectée
- ❌ Toutes les données OrbitAll seront **supprimées** (documents, threads, messages, feedback, etc.)





# Script de Suivi d'Activité pour OrbitAI

Ce script Python collecte des données sur l'activité de l'utilisateur pour détecter les tâches grises et patterns de travail.

## Versions disponibles

- **macOS** : `activity-tracker.py`
- **Windows** : `activity-tracker-windows.py`

## Fonctionnalités

- **Fenêtre active** : Détecte l'application et la fenêtre actuellement active
- **Applications en cours** : Liste toutes les applications ouvertes
- **Statistiques Mail** : Nombre total d'emails et non lus dans Mail.app
- **Onglets navigateur** : URLs et titres des onglets Safari (Chrome nécessite une extension)

## Installation

### macOS

1. **Installer les dépendances** :
```bash
pip install -r requirements-activity-tracker.txt
```

2. **Configurer les permissions macOS** :
   - Ouvrir **System Preferences** > **Security & Privacy** > **Privacy**
   - Activer les permissions pour :
     - **Accessibility** (nécessaire pour détecter les fenêtres)
     - **Automation** (pour Mail.app et Safari)

3. **Configurer les variables d'environnement** :
```bash
export USER_ID="votre-user-id-uuid"
export ORBITAI_API_URL="http://localhost:3000/api/track-activity"
```

4. **Lancer le script** :
```bash
python3 scripts/activity-tracker.py
```

### Windows

1. **Installer les dépendances** :
```bash
pip install -r requirements-activity-tracker.txt
```

2. **Configurer les variables d'environnement** :

**Command Prompt (CMD)** :
```cmd
set USER_ID=votre-user-id-uuid
set ORBITAI_API_URL=http://localhost:3000/api/track-activity
```

**PowerShell** :
```powershell
$env:USER_ID="votre-user-id-uuid"
$env:ORBITAI_API_URL="http://localhost:3000/api/track-activity"
```

3. **Lancer le script** :
```bash
python scripts/activity-tracker-windows.py
```

**Note** : Sur Windows, vous devrez peut-être exécuter en tant qu'administrateur pour certaines fonctionnalités.

## Utilisation

Le script va :
- Collecter les données toutes les 60 secondes (configurable)
- Envoyer automatiquement les données à OrbitAI
- Fonctionner en arrière-plan jusqu'à interruption (Ctrl+C)

## Différences entre macOS et Windows

### macOS
- Utilise **AppleScript** pour interagir avec les applications
- Support natif de **Mail.app** et **Safari**
- Nécessite des permissions d'accessibilité

### Windows
- Utilise **win32gui** et **COM automation** pour les fenêtres et Outlook
- Support de **Outlook** (nécessite Outlook installé et ouvert)
- Support de **Chrome** et **Edge** via PowerShell
- Peut nécessiter des privilèges d'administration

## Considérations de confidentialité

⚠️ **Important** : Ce script collecte des données sensibles sur l'activité de l'utilisateur.

- Assurez-vous d'avoir le **consentement explicite** de l'utilisateur
- Les données sont stockées de manière sécurisée dans Supabase avec RLS
- Chaque utilisateur ne voit que ses propres données
- Le script peut être arrêté à tout moment

## Architecture

```
activity-tracker.py (client)
    ↓
/api/track-activity (Next.js API)
    ↓
user_actions (Supabase)
    ↓
/api/analyze-history (analyse périodique)
    ↓
gray_tasks (tâches détectées)
```

## Améliorations possibles

- [ ] Interface graphique pour contrôler le script
- [ ] Support Chrome avec extension
- [ ] Détection du temps passé par application
- [ ] Analyse des patterns de productivité
- [ ] Export des données pour analyse externe
- [ ] Chiffrement des données sensibles côté client

## Dépannage

### macOS

**Erreur "permission denied"** :
- Vérifier les permissions dans System Preferences
- Redémarrer le terminal après avoir donné les permissions

**Mail.app ne répond pas** :
- S'assurer que Mail.app est ouvert
- Vérifier les permissions d'automation

### Windows

**Erreur "pywin32 not found"** :
- Installer pywin32 : `pip install pywin32`
- Redémarrer le terminal

**Outlook ne répond pas** :
- S'assurer qu'Outlook est installé et ouvert
- Vérifier que les composants COM sont disponibles

**Onglets navigateur vides** :
- Chrome/Edge doivent être ouverts
- Certains navigateurs nécessitent des extensions pour accéder aux URLs

### Commun

**API non accessible** :
- Vérifier que OrbitAI est démarré (npm run dev)
- Vérifier l'URL dans ORBITAI_API_URL
- Vérifier les paramètres de pare-feu Windows/macOS


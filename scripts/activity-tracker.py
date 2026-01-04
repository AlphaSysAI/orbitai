#!/usr/bin/env python3
"""
Script de suivi d'activité macOS pour OrbitAI
Collecte les données sur les fenêtres ouvertes, applications actives, emails, etc.
"""

import time
import json
import requests
import subprocess
from datetime import datetime
from typing import Dict, List, Optional
import sys
import os

# Configuration
ORBITAI_API_URL = os.getenv("ORBITAI_API_URL", "http://localhost:3000/api/track-activity")
USER_ID = os.getenv("USER_ID", "")  # À récupérer depuis l'interface OrbitAI
INTERVAL_SECONDS = 60  # Enregistrer toutes les minutes

def get_active_window_info() -> Optional[Dict]:
    """Récupère les informations sur la fenêtre active"""
    try:
        # Utiliser AppleScript pour obtenir la fenêtre active
        script = '''
        tell application "System Events"
            set frontApp to first application process whose frontmost is true
            set appName to name of frontApp
            try
                set windowTitle to name of window 1 of frontApp
            on error
                set windowTitle to ""
            end try
            return appName & "|" & windowTitle
        end tell
        '''
        
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=2
        )
        
        if result.returncode == 0:
            parts = result.stdout.strip().split("|", 1)
            return {
                "application": parts[0] if len(parts) > 0 else "",
                "window_title": parts[1] if len(parts) > 1 else "",
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        print(f"Erreur récupération fenêtre active: {e}")
    return None

def get_running_applications() -> List[Dict]:
    """Récupère la liste des applications en cours d'exécution"""
    try:
        script = '''
        tell application "System Events"
            set appList to {}
            repeat with appProc in application processes
                try
                    set appName to name of appProc
                    set appList to appList & appName
                end try
            end repeat
            return appList
        end tell
        '''
        
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            apps = result.stdout.strip().split(", ")
            return [
                {"name": app.strip(), "timestamp": datetime.now().isoformat()}
                for app in apps if app.strip()
            ]
    except Exception as e:
        print(f"Erreur récupération applications: {e}")
    return []

def get_mail_stats() -> Optional[Dict]:
    """Récupère les statistiques Mail.app (nécessite permissions)"""
    try:
        script = '''
        tell application "Mail"
            set inboxCount to count of messages in inbox
            set unreadCount to count of (messages in inbox whose read status is false)
            return inboxCount & "|" & unreadCount
        end tell
        '''
        
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=3
        )
        
        if result.returncode == 0:
            parts = result.stdout.strip().split("|")
            return {
                "total_mails": int(parts[0]) if len(parts) > 0 and parts[0].isdigit() else 0,
                "unread_mails": int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0,
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        # Mail.app n'est peut-être pas ouvert ou pas autorisé
        pass
    return None

def get_browser_tabs() -> List[Dict]:
    """Récupère les onglets ouverts dans Safari/Chrome (nécessite permissions)"""
    tabs = []
    
    # Essayer Safari
    try:
        script = '''
        tell application "Safari"
            set tabList to {}
            repeat with w in windows
                repeat with t in tabs of w
                    set tabList to tabList & (URL of t & "|" & name of t)
                end repeat
            end repeat
            return tabList
        end tell
        '''
        
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=3
        )
        
        if result.returncode == 0:
            for tab_info in result.stdout.strip().split(", "):
                if "|" in tab_info:
                    parts = tab_info.split("|", 1)
                    tabs.append({
                        "url": parts[0].strip(),
                        "title": parts[1].strip() if len(parts) > 1 else "",
                        "browser": "Safari",
                        "timestamp": datetime.now().isoformat(),
                    })
    except:
        pass
    
    # Essayer Chrome (nécessite Chrome AppleScript support)
    # Chrome n'a pas de support AppleScript natif, nécessiterait une extension
    
    return tabs

def send_activity_to_orbitai(activity_data: Dict):
    """Envoie les données d'activité à l'API OrbitAI"""
    try:
        response = requests.post(
            ORBITAI_API_URL,
            json={
                "userId": USER_ID,
                "activity": activity_data,
            },
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        
        if response.status_code == 200:
            print(f"✓ Activité envoyée: {activity_data.get('active_window', {}).get('application', 'N/A')}")
        else:
            print(f"✗ Erreur envoi: {response.status_code}")
    except Exception as e:
        print(f"✗ Erreur connexion API: {e}")

def collect_activity_snapshot() -> Dict:
    """Collecte un snapshot complet de l'activité"""
    return {
        "active_window": get_active_window_info(),
        "running_applications": get_running_applications(),
        "mail_stats": get_mail_stats(),
        "browser_tabs": get_browser_tabs(),
        "system_time": datetime.now().isoformat(),
    }

def main():
    """Boucle principale de suivi"""
    if not USER_ID:
        print("❌ USER_ID non défini. Définissez la variable d'environnement USER_ID.")
        print("   Exemple: export USER_ID='votre-user-id'")
        sys.exit(1)
    
    print(f"🚀 Démarrage du suivi d'activité pour l'utilisateur {USER_ID}")
    print(f"⏱️  Intervalle: {INTERVAL_SECONDS} secondes")
    print("⚠️  Assurez-vous d'avoir donné les permissions nécessaires:")
    print("   - Accès à l'accessibilité (System Preferences > Security & Privacy > Accessibility)")
    print("   - Accès à Mail.app (si vous voulez suivre les emails)")
    print("   - Accès à Safari/Chrome (si vous voulez suivre les onglets)")
    print("\nAppuyez sur Ctrl+C pour arrêter\n")
    
    try:
        while True:
            activity = collect_activity_snapshot()
            send_activity_to_orbitai(activity)
            time.sleep(INTERVAL_SECONDS)
    except KeyboardInterrupt:
        print("\n\n👋 Arrêt du suivi d'activité")
        sys.exit(0)

if __name__ == "__main__":
    main()


#!/usr/bin/env python3
"""
Script de suivi d'activité Windows pour OrbitAI
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

# Imports spécifiques Windows
try:
    import win32gui
    import win32process
    import win32con
    import psutil
except ImportError:
    print("❌ Bibliothèques Windows manquantes.")
    print("Installez-les avec: pip install pywin32 psutil")
    sys.exit(1)

# Configuration
ORBITAI_API_URL = os.getenv("ORBITAI_API_URL", "http://localhost:3000/api/track-activity")
USER_ID = os.getenv("USER_ID", "")  # À récupérer depuis l'interface OrbitAI
INTERVAL_SECONDS = 60  # Enregistrer toutes les minutes

def get_active_window_info() -> Optional[Dict]:
    """Récupère les informations sur la fenêtre active"""
    try:
        hwnd = win32gui.GetForegroundWindow()
        window_title = win32gui.GetWindowText(hwnd)
        
        # Récupérer le nom du processus
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        try:
            process = psutil.Process(pid)
            app_name = process.name()
            # Enlever l'extension .exe si présente
            if app_name.endswith('.exe'):
                app_name = app_name[:-4]
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            app_name = "Unknown"
        
        return {
            "application": app_name,
            "window_title": window_title,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        print(f"Erreur récupération fenêtre active: {e}")
    return None

def get_running_applications() -> List[Dict]:
    """Récupère la liste des applications en cours d'exécution"""
    try:
        apps = []
        seen_apps = set()
        
        # Parcourir toutes les fenêtres visibles
        def enum_windows_callback(hwnd, apps_list):
            if win32gui.IsWindowVisible(hwnd):
                window_title = win32gui.GetWindowText(hwnd)
                if window_title:
                    try:
                        _, pid = win32process.GetWindowThreadProcessId(hwnd)
                        process = psutil.Process(pid)
                        app_name = process.name()
                        if app_name.endswith('.exe'):
                            app_name = app_name[:-4]
                        
                        # Éviter les doublons
                        if app_name not in seen_apps:
                            seen_apps.add(app_name)
                            apps_list.append({
                                "name": app_name,
                                "timestamp": datetime.now().isoformat()
                            })
                    except (psutil.NoSuchProcess, psutil.AccessDenied, ValueError):
                        pass
        
        win32gui.EnumWindows(enum_windows_callback, apps)
        return apps
    except Exception as e:
        print(f"Erreur récupération applications: {e}")
    return []

def get_outlook_stats() -> Optional[Dict]:
    """Récupère les statistiques Outlook (nécessite Outlook installé et ouvert)"""
    try:
        # Utiliser COM automation pour Outlook
        import win32com.client
        
        outlook = win32com.client.Dispatch("Outlook.Application")
        namespace = outlook.GetNamespace("MAPI")
        inbox = namespace.GetDefaultFolder(6)  # 6 = olFolderInbox
        
        messages = inbox.Items
        total_mails = messages.Count
        
        # Compter les non lus
        unread_count = 0
        for message in messages:
            if message.UnRead:
                unread_count += 1
                if unread_count > 1000:  # Limiter pour performance
                    break
        
        return {
            "total_mails": total_mails,
            "unread_mails": unread_count,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        # Outlook n'est peut-être pas installé ou pas ouvert
        pass
    return None

def get_browser_tabs() -> List[Dict]:
    """Récupère les onglets ouverts dans Chrome/Edge via PowerShell"""
    tabs = []
    
    # Essayer Chrome
    try:
        ps_script = '''
        $chrome = Get-Process chrome -ErrorAction SilentlyContinue
        if ($chrome) {
            $chrome | ForEach-Object {
                $title = $_.MainWindowTitle
                if ($title -and $title -ne "") {
                    Write-Output $title
                }
            }
        }
        '''
        result = subprocess.run(
            ["powershell", "-Command", ps_script],
            capture_output=True,
            text=True,
            timeout=3,
            shell=True
        )
        
        if result.returncode == 0:
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    tabs.append({
                        "title": line.strip(),
                        "url": "",  # Nécessiterait une extension Chrome pour obtenir l'URL
                        "browser": "Chrome",
                        "timestamp": datetime.now().isoformat(),
                    })
    except Exception as e:
        print(f"Erreur récupération onglets Chrome: {e}")
    
    # Essayer Edge
    try:
        ps_script = '''
        $edge = Get-Process msedge -ErrorAction SilentlyContinue
        if ($edge) {
            $edge | ForEach-Object {
                $title = $_.MainWindowTitle
                if ($title -and $title -ne "") {
                    Write-Output $title
                }
            }
        }
        '''
        result = subprocess.run(
            ["powershell", "-Command", ps_script],
            capture_output=True,
            text=True,
            timeout=3,
            shell=True
        )
        
        if result.returncode == 0:
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    tabs.append({
                        "title": line.strip(),
                        "url": "",
                        "browser": "Edge",
                        "timestamp": datetime.now().isoformat(),
                    })
    except Exception as e:
        print(f"Erreur récupération onglets Edge: {e}")
    
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
        "mail_stats": get_outlook_stats(),
        "browser_tabs": get_browser_tabs(),
        "system_time": datetime.now().isoformat(),
    }

def main():
    """Boucle principale de suivi"""
    if not USER_ID:
        print("❌ USER_ID non défini. Définissez la variable d'environnement USER_ID.")
        print("   Exemple: set USER_ID=votre-user-id")
        print("   Ou dans PowerShell: $env:USER_ID='votre-user-id'")
        sys.exit(1)
    
    print(f"🚀 Démarrage du suivi d'activité Windows pour l'utilisateur {USER_ID}")
    print(f"⏱️  Intervalle: {INTERVAL_SECONDS} secondes")
    print("\n⚠️  Notes importantes:")
    print("   - Le script nécessite des privilèges d'administration pour certaines fonctionnalités")
    print("   - Outlook doit être ouvert pour suivre les emails")
    print("   - Chrome/Edge doivent être ouverts pour suivre les onglets")
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






#!/usr/bin/env python3
"""
Script de suivi d'activité macOS pour OrbitAI
Collecte les données sur les fenêtres ouvertes, applications actives, événements souris/clavier
Basé sur pynput pour passer la sécurité macOS
"""

import time
import json
import requests
import subprocess
from datetime import datetime
from pynput import mouse, keyboard
import os
import sys

# Configuration
ORBITAI_API_URL = os.getenv("ORBITAI_API_URL", "http://localhost:3000/api/track-activity")
USER_ID = os.getenv("USER_ID", "")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
log_file = os.path.join(BASE_DIR, "logs", "orbitai_activity_log.json")

# Créer le dossier si besoin
os.makedirs(os.path.dirname(log_file), exist_ok=True)

logs = []
BROWSERS = ["Google Chrome", "Safari", "Firefox", "Brave Browser", "Arc", "Microsoft Edge", "Opera"]
USEFUL_APPS = ["Google Chrome", "Excel", "Word", "Notion", "Outlook", "Terminal"]
USELESS_APPS = ["Discord", "YouTube", "Battle.net"]

# Session
current_session_id = 0
current_session = {
    "id": 0,
    "app": None,
    "start_time": None,
    "keypress_count": 0,
    "mouse_click_count": 0,
    "events": [],
    "classification": "neutral"
}

# Buffer pour l'envoi en batch à l'API
activity_buffer = []
BUFFER_SIZE = 10  # Envoyer toutes les 10 activités
SEND_INTERVAL = 60  # Ou toutes les 60 secondes

def load_existing_logs():
    """Charge les logs existants depuis le fichier"""
    if os.path.exists(log_file):
        with open(log_file, "r") as f:
            try:
                return json.load(f)
            except:
                return []
    return []

def save_logs():
    """Sauvegarde les logs dans le fichier local"""
    with open(log_file, "w") as f:
        json.dump(logs, f, indent=2)

def get_active_app():
    """Récupère l'application active via AppleScript"""
    try:
        script = 'tell application "System Events" to get name of (processes where frontmost is true)'
        output = subprocess.check_output(['osascript', '-e', script], timeout=2)
        return output.decode("utf-8").strip()
    except Exception:
        return "Unknown"

def get_active_window_info():
    """Récupère les informations sur la fenêtre active (app + titre)"""
    try:
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
    except Exception:
        pass
    return None

def get_running_applications():
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
    except Exception:
        pass
    return []

def get_mail_stats():
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
    except Exception:
        pass
    return None

def get_browser_tabs():
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
    except Exception:
        pass
    
    # Essayer Chrome (nécessite Chrome AppleScript support)
    # Chrome n'a pas de support AppleScript natif complet, mais on peut essayer
    try:
        script = '''
        tell application "Google Chrome"
            set tabList to {}
            repeat with w in windows
                repeat with t in tabs of w
                    set tabList to tabList & (URL of t & "|" & title of t)
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
                        "browser": "Chrome",
                        "timestamp": datetime.now().isoformat(),
                    })
    except Exception:
        pass
    
    return tabs

def classify_app(app_name):
    """Classe l'application selon son utilité"""
    if app_name in USEFUL_APPS:
        return "useful"
    elif app_name in USELESS_APPS:
        return "non_useful"
    return "neutral"

def log_event(event_type, details):
    """Enregistre un événement localement"""
    event = {
        "timestamp": datetime.now().isoformat(),
        "session_id": current_session["id"],
        "type": event_type,
        "details": details
    }
    current_session["events"].append(event)
    logs.append(event)
    save_logs()
    
    # Ajouter au buffer pour envoi à l'API
    activity_buffer.append(event)
    
    # Envoyer si le buffer est plein
    if len(activity_buffer) >= BUFFER_SIZE:
        send_activities_to_api()

def collect_activity_snapshot():
    """Collecte un snapshot complet de l'activité système"""
    return {
        "active_window": get_active_window_info(),
        "running_applications": get_running_applications(),
        "mail_stats": get_mail_stats(),
        "browser_tabs": get_browser_tabs(),
        "system_time": datetime.now().isoformat(),
    }

def send_activities_to_api():
    """Envoie les activités en buffer à l'API OrbitAI"""
    if not activity_buffer or not USER_ID:
        return
    
    try:
        # Collecter un snapshot système actuel
        snapshot = collect_activity_snapshot()
        
        # Préparer les données à envoyer (format hybride)
        payload = {
            "userId": USER_ID,
            "activities": activity_buffer.copy(),
            "current_session": {
                "id": current_session["id"],
                "app": current_session["app"],
                "classification": current_session["classification"],
                "keypress_count": current_session["keypress_count"],
                "mouse_click_count": current_session["mouse_click_count"],
            },
            # Ajouter aussi le snapshot système pour compatibilité
            "activity": snapshot
        }
        
        response = requests.post(
            ORBITAI_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        
        if response.status_code == 200:
            print(f"✓ {len(activity_buffer)} activité(s) + snapshot envoyé(s) à OrbitAI")
            activity_buffer.clear()
        else:
            print(f"✗ Erreur envoi API: {response.status_code} - {response.text[:100]}")
    except Exception as e:
        print(f"✗ Erreur connexion API: {e}")

def detect_probable_email_send(app_name, duration):
    """Détecte un probable envoi d'email basé sur l'activité"""
    if (
        app_name in BROWSERS
        and duration >= 20
        and current_session["keypress_count"] >= 15
        and current_session["mouse_click_count"] >= 1
    ):
        log_event("inferred_event", {
            "action": "probable_email_sent",
            "app": app_name,
            "duration_seconds": int(duration),
            "keypress_count": current_session["keypress_count"],
            "mouse_click_count": current_session["mouse_click_count"],
            "confidence": 0.92
        })

def log_window_change(app_name, duration):
    """Enregistre un changement de fenêtre/application"""
    log_event("window_switch", {
        "app": app_name,
        "duration_seconds": int(duration)
    })

def start_new_session(app_name):
    """Démarre une nouvelle session pour une application"""
    global current_session_id
    current_session_id += 1
    return {
        "id": current_session_id,
        "app": app_name,
        "start_time": time.time(),
        "keypress_count": 0,
        "mouse_click_count": 0,
        "events": [],
        "classification": classify_app(app_name)
    }

def on_click(x, y, button, pressed):
    """Callback pour les clics de souris"""
    if current_session["app"] in BROWSERS and pressed:
        current_session["mouse_click_count"] += 1
    state = "pressed" if pressed else "released"
    log_event("mouse_click", {"position": (x, y), "button": str(button), "state": state})

def on_press(key):
    """Callback pour les pressions de touches"""
    if current_session["app"] in BROWSERS:
        current_session["keypress_count"] += 1
    try:
        log_event("key_press", {"key": key.char})
    except AttributeError:
        log_event("key_press", {"key": str(key)})

def main():
    """Fonction principale"""
    global logs, current_session
    
    if not USER_ID:
        print("❌ USER_ID non défini. Définissez la variable d'environnement USER_ID.")
        print("   Exemple: export USER_ID='votre-user-id'")
        sys.exit(1)
    
    if not ORBITAI_API_URL:
        print("❌ ORBITAI_API_URL non défini.")
        sys.exit(1)
    
    print("🛰 OrbitAI tracker lancé... (Ctrl+C pour arrêter)")
    print(f"👤 User ID: {USER_ID}")
    print(f"🌐 API URL: {ORBITAI_API_URL}")
    print("\n⚠️  Assurez-vous d'avoir donné les permissions nécessaires:")
    print("   - Accès à l'accessibilité (System Preferences > Security & Privacy > Accessibility)")
    print("   - Accès à l'entrée (Input Monitoring) pour le clavier")
    print("   - Accès à Mail.app (si vous voulez suivre les emails)")
    print("   - Accès à Safari/Chrome (si vous voulez suivre les onglets)\n")
    
    logs = load_existing_logs()
    
    # Démarrer les listeners pour souris et clavier
    mouse_listener = mouse.Listener(on_click=on_click)
    keyboard_listener = keyboard.Listener(on_press=on_press)
    mouse_listener.start()
    keyboard_listener.start()
    
    prev_app = get_active_app()
    prev_time = time.time()
    current_session = start_new_session(prev_app)
    
    last_api_send = time.time()
    
    try:
        while True:
            time.sleep(1)
            current_app = get_active_app()
            now = time.time()
            duration = now - prev_time
            
            # Vérifier si on doit envoyer les activités (intervalle de temps)
            if now - last_api_send >= SEND_INTERVAL and activity_buffer:
                send_activities_to_api()
                last_api_send = now
            
            if current_app != prev_app:
                # Changement d'application détecté
                detect_probable_email_send(prev_app, duration)
                log_window_change(prev_app, duration)
                
                # Enregistrer aussi le snapshot système lors du changement
                snapshot = collect_activity_snapshot()
                log_event("system_snapshot", {
                    "trigger": "app_change",
                    "from_app": prev_app,
                    "to_app": current_app,
                    "snapshot": snapshot
                })
                
                current_session = start_new_session(current_app)
                prev_app = current_app
                prev_time = now
            
            elif duration > 30:
                # Session longue, faire un checkpoint
                log_window_change(current_app, duration)
                detect_probable_email_send(current_app, duration)
                
                # Enregistrer un snapshot système périodique
                snapshot = collect_activity_snapshot()
                log_event("system_snapshot", {
                    "trigger": "periodic_checkpoint",
                    "app": current_app,
                    "duration_seconds": int(duration),
                    "snapshot": snapshot
                })
                
                current_session = start_new_session(current_app)
                prev_time = now
                
    except KeyboardInterrupt:
        print("\n⛔ Arrêt du tracker...")
        # Envoyer les activités restantes avant de quitter
        if activity_buffer:
            print("📤 Envoi des dernières activités...")
            send_activities_to_api()
        mouse_listener.stop()
        keyboard_listener.stop()
        print("👋 Arrêt terminé.")

if __name__ == "__main__":
    main()

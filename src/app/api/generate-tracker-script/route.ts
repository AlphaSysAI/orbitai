import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const os = searchParams.get('os'); // 'macos' ou 'windows'

    if (!userId || !os) {
      return NextResponse.json(
        { error: "userId et os requis" },
        { status: 400 }
      );
    }

    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const trackActivityUrl = `${apiUrl}/api/track-activity`;

    if (os === 'macos') {
      // Générer un script .command pour macOS (s'exécute au double-clic)
      const script = `#!/bin/bash
# Script de tracking OrbitAI pour macOS
# Généré automatiquement avec votre User ID

set -e

# Couleurs
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
RED='\\033[0;31m'
NC='\\033[0m'

echo -e "\${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${NC}"
echo -e "\${GREEN}🚀 OrbitAI - Tracking d'activité\${NC}"
echo -e "\${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\${NC}"
echo ""

# Vérifier que le script a les permissions d'exécution
if [ ! -x "\$0" ]; then
    echo -e "\${YELLOW}⚠️  Le script n'a pas les permissions d'exécution.\${NC}"
    echo -e "\${BLUE}Tentative d'ajout des permissions...\${NC}"
    chmod +x "\$0"
    if [ $? -eq 0 ]; then
        echo -e "\${GREEN}✓ Permissions ajoutées. Veuillez relancer le script.\${NC}"
        read -p "Appuyez sur Entrée pour quitter..."
        exit 0
    else
        echo -e "\${RED}❌ Impossible d'ajouter les permissions automatiquement.\${NC}"
        echo ""
        echo -e "\${YELLOW}Veuillez exécuter cette commande dans Terminal :\${NC}"
        echo -e "\${BLUE}chmod +x "\$0"\${NC}"
        echo ""
        read -p "Appuyez sur Entrée pour quitter..."
        exit 1
    fi
fi

# Obtenir le répertoire du script
SCRIPT_DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"

# Configuration
export USER_ID="${userId}"
export ORBITAI_API_URL="${trackActivityUrl}"

# Vérifier Python
if ! command -v python3 &> /dev/null; then
    echo -e "\${YELLOW}❌ Python 3 n'est pas installé.\${NC}"
    echo "   Installez Python depuis https://www.python.org/downloads/"
    read -p "Appuyez sur Entrée pour quitter..."
    exit 1
fi

# Vérifier et installer les dépendances si nécessaire
echo -e "\${YELLOW}Vérification des dépendances...\${NC}"

# Fonction pour installer les dépendances avec différentes méthodes
install_dependencies() {
    # Liste des dépendances à installer
    DEPS="requests pynput"
    
    # Méthode 1: Essayer avec --user (recommandé pour macOS/Homebrew)
    if pip3 install -q --user \$DEPS 2>/dev/null; then
        echo -e "\${GREEN}✓ Dépendances installées (mode utilisateur)\${NC}"
        return 0
    fi
    
    # Méthode 2: Essayer avec --break-system-packages (si nécessaire)
    if pip3 install -q --break-system-packages \$DEPS 2>/dev/null; then
        echo -e "\${GREEN}✓ Dépendances installées\${NC}"
        return 0
    fi
    
    # Méthode 3: Essayer sans flag (pour les anciens systèmes)
    if pip3 install -q \$DEPS 2>/dev/null; then
        echo -e "\${GREEN}✓ Dépendances installées\${NC}"
        return 0
    fi
    
    return 1
}

# Vérifier si les dépendances sont déjà installées
if python3 -c "import requests, pynput" 2>/dev/null; then
    echo -e "\${GREEN}✓ Dépendances déjà installées\${NC}"
elif command -v pip3 &> /dev/null; then
    echo -e "\${YELLOW}Installation des dépendances Python (requests, pynput)...\${NC}"
    if ! install_dependencies; then
        echo -e "\${RED}❌ Erreur lors de l'installation des dépendances.\${NC}"
        echo -e "\${YELLOW}Veuillez installer manuellement :\${NC}"
        echo -e "\${BLUE}pip3 install --user requests pynput\${NC}"
        echo ""
        read -p "Appuyez sur Entrée pour quitter..."
        exit 1
    fi
else
    echo -e "\${YELLOW}pip3 non trouvé, tentative d'initialisation...\${NC}"
    python3 -m ensurepip --upgrade --user 2>/dev/null || true
    if command -v pip3 &> /dev/null; then
        install_dependencies || {
            echo -e "\${RED}❌ Erreur lors de l'installation des dépendances.\${NC}"
            read -p "Appuyez sur Entrée pour quitter..."
            exit 1
        }
    else
        echo -e "\${RED}❌ pip3 n'est pas disponible. Veuillez installer Python avec pip.\${NC}"
        read -p "Appuyez sur Entrée pour quitter..."
        exit 1
    fi
fi

# Demander les permissions système
echo -e "\${YELLOW}Vérification et demande des permissions système...\${NC}"
echo ""

# Demander la permission d'accessibilité (Accessibility)
echo -e "\${BLUE}📋 Permission d'accessibilité (Accessibility)\${NC}"
echo -e "\${YELLOW}Cette permission est nécessaire pour suivre les fenêtres et applications actives.\${NC}"
echo ""

# Essayer d'accéder à System Events - cela déclenchera la demande de permission si elle n'est pas déjà accordée
if ! osascript -e 'tell application "System Events" to get name of processes' > /dev/null 2>&1; then
    echo -e "\${YELLOW}⚠️  Permission d'accessibilité non accordée.\${NC}"
    echo -e "\${BLUE}Une boîte de dialogue va apparaître. Cliquez sur \\"Autoriser\\" ou \\"Ouvrir les préférences système\\".\${NC}"
    echo ""
    # Ouvrir les préférences système directement à la page des permissions d'accessibilité
    open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility" 2>/dev/null || open "x-apple.systempreferences:com.apple.preference.security" 2>/dev/null || true
    
    echo -e "\${BLUE}Dans les Préférences Système :\${NC}"
    echo "   1. Recherchez \\"orbitai-tracker.command\\" ou \\"Terminal\\" dans la liste"
    echo "   2. Cochez la case à côté pour autoriser"
    echo "   3. Vous devrez peut-être redémarrer ce script après avoir accordé la permission"
    echo ""
    
    read -p "Appuyez sur Entrée une fois la permission accordée... "
else
    echo -e "\${GREEN}✓ Permission d'accessibilité déjà accordée\${NC}"
fi

echo ""

# Demander la permission d'automatisation si nécessaire (sera demandée automatiquement lors de l'utilisation)
echo -e "\${BLUE}📋 Permission d'automatisation (Automation)\${NC}"
echo -e "\${YELLOW}Cette permission peut être demandée automatiquement lors de l'accès aux applications (Mail, Safari, etc.)\${NC}"
echo -e "\${BLUE}Si une boîte de dialogue apparaît, cliquez sur \\"Autoriser\\".\${NC}"
echo ""

echo -e "\${GREEN}✓ Vérification des permissions terminée\${NC}"
echo ""

# Lancer le tracker
echo -e "\${GREEN}✓ Démarrage du tracking...\${NC}"
echo -e "\${BLUE}Appuyez sur Ctrl+C pour arrêter\${NC}"
echo ""

cd "\$SCRIPT_DIR"
python3 activity-tracker.py
`;

      return new Response(script, {
        headers: {
          'Content-Type': 'application/x-sh',
          'Content-Disposition': `attachment; filename="orbitai-tracker.command"`,
        },
      });
    } else if (os === 'windows') {
      // Générer un script .bat pour Windows
      const script = `@echo off
REM Script de tracking OrbitAI pour Windows
REM Généré automatiquement avec votre User ID

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 🚀 OrbitAI - Tracking d'activité
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Obtenir le répertoire du script
set "SCRIPT_DIR=%~dp0"

REM Configuration
set "USER_ID=${userId}"
set "ORBITAI_API_URL=${trackActivityUrl}"

REM Vérifier Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python n'est pas installé.
    echo    Installez Python depuis https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Vérifier et installer les dépendances si nécessaire
echo Vérification des dépendances...
python -c "import requests" >nul 2>&1
if errorlevel 1 (
    echo Installation des dépendances Python...
    pip install --quiet --upgrade pip 2>nul
    pip install --quiet requests pywin32 psutil
    echo ✓ Dépendances installées
) else (
    echo ✓ Dépendances déjà installées
)

REM Demander les permissions système (Windows)
echo.
echo Vérification des permissions système...
echo ⚠️  Si une boîte de contrôle de compte d'utilisateur apparaît, cliquez sur "Oui"
echo.
REM Vérifier si le script est exécuté en tant qu'administrateur
net session >nul 2>&1
if errorlevel 1 (
    echo ℹ️  Certaines fonctionnalités peuvent nécessiter des privilèges administrateur
    echo    Si vous rencontrez des problèmes, exécutez ce script en tant qu'administrateur
    echo    (clic droit ^> Exécuter en tant qu'administrateur)
) else (
    echo ✓ Script exécuté avec privilèges administrateur
)
echo.

REM Lancer le tracker
echo ✓ Démarrage du tracking...
echo Appuyez sur Ctrl+C pour arrêter
echo.

cd /d "%SCRIPT_DIR%"
python activity-tracker-windows.py
pause
`;

      return new Response(script, {
        headers: {
          'Content-Type': 'application/x-msdos-program',
          'Content-Disposition': `attachment; filename="orbitai-tracker.bat"`,
        },
      });
    } else {
      return NextResponse.json(
        { error: "OS non supporté" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("❌ ERREUR GENERATE SCRIPT:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la génération" },
      { status: 500 }
    );
  }
}


#!/bin/bash
# Script d'installation et de lancement automatique pour macOS

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 OrbitAI - Configuration automatique du tracking d'activité (macOS)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Vérifier Python
echo -e "${YELLOW}1. Vérification de Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 n'est pas installé.${NC}"
    echo "   Installez Python depuis https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✓ ${PYTHON_VERSION} trouvé${NC}"
echo ""

# Vérifier pip
echo -e "${YELLOW}2. Vérification de pip...${NC}"
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}❌ pip3 n'est pas installé.${NC}"
    echo "   Installation de pip..."
    python3 -m ensurepip --upgrade
fi
echo -e "${GREEN}✓ pip3 disponible${NC}"
echo ""

# Demander le USER_ID
echo -e "${YELLOW}3. Configuration...${NC}"
if [ -z "$USER_ID" ]; then
    echo -e "${BLUE}Entrez votre User ID (visible dans OrbitAI) :${NC}"
    read -r USER_ID
    if [ -z "$USER_ID" ]; then
        echo -e "${RED}❌ User ID requis${NC}"
        exit 1
    fi
fi

ORBITAI_API_URL="${ORBITAI_API_URL:-http://localhost:3000/api/track-activity}"

echo -e "${GREEN}✓ User ID: ${USER_ID}${NC}"
echo -e "${GREEN}✓ API URL: ${ORBITAI_API_URL}${NC}"
echo ""

# Obtenir le répertoire du script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Installer les dépendances
echo -e "${YELLOW}4. Installation des dépendances Python...${NC}"
pip3 install -q --upgrade pip
pip3 install -q -r "$SCRIPT_DIR/requirements-activity-tracker.txt"
echo -e "${GREEN}✓ Dépendances installées${NC}"
echo ""

# Vérifier les permissions macOS
echo -e "${YELLOW}5. Vérification des permissions macOS...${NC}"
echo -e "${BLUE}⚠️  Assurez-vous d'avoir donné les permissions suivantes :${NC}"
echo "   • System Preferences > Security & Privacy > Privacy > Accessibility"
echo "   • System Preferences > Security & Privacy > Privacy > Automation"
echo ""
echo -e "${BLUE}Appuyez sur Entrée une fois les permissions configurées...${NC}"
read -r

# Exporter les variables d'environnement
export USER_ID
export ORBITAI_API_URL

# Lancer le script
echo -e "${YELLOW}6. Lancement du tracker...${NC}"
echo -e "${GREEN}✓ Le tracking démarre maintenant${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Appuyez sur Ctrl+C pour arrêter le tracking${NC}"
echo ""

cd "$SCRIPT_DIR"
python3 activity-tracker.py


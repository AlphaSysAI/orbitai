# Script d'installation et de lancement automatique pour Windows (PowerShell)

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🚀 OrbitAI - Configuration automatique du tracking d'activité (Windows)" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Vérifier Python
Write-Host "1. Vérification de Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ $pythonVersion trouvé" -ForegroundColor Green
} catch {
    Write-Host "❌ Python n'est pas installé." -ForegroundColor Red
    Write-Host "   Installez Python depuis https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "   Assurez-vous de cocher 'Add Python to PATH' lors de l'installation" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Vérifier pip
Write-Host "2. Vérification de pip..." -ForegroundColor Yellow
try {
    $pipVersion = pip --version 2>&1
    Write-Host "✓ pip disponible" -ForegroundColor Green
} catch {
    Write-Host "❌ pip n'est pas installé. Installation..." -ForegroundColor Yellow
    python -m ensurepip --upgrade
}
Write-Host ""

# Demander le USER_ID
Write-Host "3. Configuration..." -ForegroundColor Yellow
if (-not $env:USER_ID) {
    $userInput = Read-Host "Entrez votre User ID (visible dans OrbitAI)"
    if ([string]::IsNullOrWhiteSpace($userInput)) {
        Write-Host "❌ User ID requis" -ForegroundColor Red
        exit 1
    }
    $env:USER_ID = $userInput
}

if (-not $env:ORBITAI_API_URL) {
    $env:ORBITAI_API_URL = "http://localhost:3000/api/track-activity"
}

Write-Host "✓ User ID: $env:USER_ID" -ForegroundColor Green
Write-Host "✓ API URL: $env:ORBITAI_API_URL" -ForegroundColor Green
Write-Host ""

# Obtenir le répertoire du script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Installer les dépendances
Write-Host "4. Installation des dépendances Python..." -ForegroundColor Yellow
pip install --quiet --upgrade pip
pip install --quiet -r "$scriptDir\requirements-activity-tracker.txt"
Write-Host "✓ Dépendances installées" -ForegroundColor Green
Write-Host ""

# Vérifier les privilèges administrateur
Write-Host "5. Vérification des privilèges..." -ForegroundColor Yellow
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  Certaines fonctionnalités peuvent nécessiter des privilèges administrateur" -ForegroundColor Yellow
} else {
    Write-Host "✓ Privilèges administrateur détectés" -ForegroundColor Green
}
Write-Host ""

# Lancer le script
Write-Host "6. Lancement du tracker..." -ForegroundColor Yellow
Write-Host "✓ Le tracking démarre maintenant" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Appuyez sur Ctrl+C pour arrêter le tracking" -ForegroundColor Yellow
Write-Host ""

Set-Location $scriptDir
python activity-tracker-windows.py






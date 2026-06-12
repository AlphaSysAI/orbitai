"use client";

import { useState, useEffect } from "react";
import { Sparkles, ListChecks, Zap, TrendingUp, Clock, CheckCircle2, RefreshCw, Activity, Play, Square, StopCircle, Download } from "lucide-react";
import { AutomationStats, GrayTask, Automation } from "../types";

interface AutomationDashboardProps {
  stats: AutomationStats | null;
  tasks: GrayTask[];
  automations: Automation[];
  isLoading: boolean;
  onAnalyzeHistory?: () => Promise<void>;
  userId?: string;
}

export function AutomationDashboard({ stats, tasks, automations, isLoading, onAnalyzeHistory, userId }: AutomationDashboardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<{ isActive: boolean; message: string; lastActivity?: string; hasEverTracked?: boolean } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [detectedOS, setDetectedOS] = useState<'macos' | 'windows' | 'linux' | 'unknown'>('unknown');
  const [hasDownloadedScript, setHasDownloadedScript] = useState(false);

  // Détecter le système d'exploitation et vérifier si le script a déjà été téléchargé
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const platform = window.navigator.platform.toLowerCase();
      const userAgent = window.navigator.userAgent.toLowerCase();
      
      if (platform.includes('mac') || userAgent.includes('mac')) {
        setDetectedOS('macos');
      } else if (platform.includes('win') || userAgent.includes('windows')) {
        setDetectedOS('windows');
      } else if (platform.includes('linux') || userAgent.includes('linux')) {
        setDetectedOS('linux');
      } else {
        setDetectedOS('unknown');
      }

      // Vérifier dans localStorage si un script a déjà été téléchargé
      const downloaded = localStorage.getItem('orbitai_tracker_downloaded');
      if (downloaded === 'true') {
        setHasDownloadedScript(true);
      }
    }
  }, []);

  // Vérifier le statut du tracking
  const checkTrackingStatus = async () => {
    if (!userId) return;
    setIsCheckingStatus(true);
    try {
      const response = await fetch(`/api/tracking-status?userId=${userId}`);
      const data = await response.json();
      setTrackingStatus(data);
    } catch (error) {
      console.error("Erreur vérification statut:", error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Vérifier le statut au chargement et toutes les 30 secondes
  useEffect(() => {
    if (userId) {
      checkTrackingStatus();
      const interval = setInterval(checkTrackingStatus, 30000); // Toutes les 30 secondes
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Fonction pour télécharger et installer le script
  const handleDownloadAndInstall = async () => {
    if (!userId) {
      alert("User ID manquant. Veuillez rafraîchir la page.");
      return;
    }

    if (detectedOS !== 'macos' && detectedOS !== 'windows') {
      alert("Système d'exploitation non supporté pour l'installation automatique.");
      return;
    }

    // Si le script est déjà téléchargé, donner des instructions pour le lancer
    if (hasDownloadedScript || trackingStatus?.hasEverTracked) {
      const filename = detectedOS === 'macos' ? 'orbitai-tracker.command' : 'orbitai-tracker.bat';
      
      if (detectedOS === 'macos') {
        const launchMessage = `Le script est déjà téléchargé dans votre dossier Téléchargements.

📋 POUR LANCER LE TRACKING :

Option 1 - Via Terminal (Recommandé) :
1. Ouvrez Terminal (Applications > Utilitaires > Terminal)
2. Tapez : cd ~/Downloads
3. Tapez : chmod +x orbitai-tracker.command
4. Tapez : ./orbitai-tracker.command

Option 2 - Via Finder :
1. Ouvrez le Finder et allez dans Téléchargements
2. Faites un clic DROIT (ou Ctrl+clic) sur "orbitai-tracker.command"
3. Sélectionnez "Ouvrir" (pas double-clic)
4. Cliquez sur "Ouvrir" dans la boîte de dialogue qui apparaît

⚠️ Si vous voyez une erreur "privilèges d'accès", utilisez la méthode Terminal.

Le script s'installera et se lancera automatiquement.
Cette page vérifiera automatiquement le statut du tracking.`;

        if (window.confirm(launchMessage + '\n\nVoulez-vous ouvrir le dossier Téléchargements maintenant ?')) {
          // Ouvrir le dossier Téléchargements sur macOS
          window.open('x-apple-finder://Users/' + (window.navigator.userAgent.includes('Mac') ? '~' : '') + '/Downloads');
        }
      } else {
        const launchMessage = `Le script est déjà téléchargé dans votre dossier Téléchargements.

Pour le lancer :
1. Ouvrez l'Explorateur de fichiers
2. Allez dans Téléchargements
3. Double-cliquez sur "orbitai-tracker.bat"
4. Autorisez l'exécution si Windows demande confirmation

Le script s'installera et se lancera automatiquement.
Cette page vérifiera automatiquement le statut du tracking.`;

        alert(launchMessage);
      }
      
      // Vérifier le statut après un délai
      setTimeout(() => {
        checkTrackingStatus();
        const checkInterval = setInterval(() => {
          checkTrackingStatus();
        }, 5000);
        
        setTimeout(() => {
          clearInterval(checkInterval);
        }, 60000); // Vérifier pendant 1 minute
      }, 3000);
      
      return; // Ne pas télécharger à nouveau
    }

    // Demander confirmation à l'utilisateur
    const confirmMessage = `Vous allez télécharger et lancer un script de tracking d'activité.

Ce script va :
• Installer les dépendances Python nécessaires
• Collecter des données sur votre activité (fenêtres, applications, emails)
• Envoyer ces données à OrbitAI pour détecter les tâches grises

⚠️ IMPORTANT : Vous devrez donner les permissions nécessaires à votre système.

Voulez-vous continuer ?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // Générer et télécharger le script personnalisé
      const response = await fetch(`/api/generate-tracker-script?userId=${userId}&os=${detectedOS}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filename = detectedOS === 'macos' ? 'orbitai-tracker.command' : 'orbitai-tracker.bat';
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Mémoriser que le script a été téléchargé
      localStorage.setItem('orbitai_tracker_downloaded', 'true');
      setHasDownloadedScript(true);

      // Instructions selon l'OS
      if (detectedOS === 'macos') {
        const launchMessage = `Le script a été téléchargé dans votre dossier Téléchargements.

📋 INSTRUCTIONS D'INSTALLATION (IMPORTANT) :

⚠️ macOS bloque l'exécution des fichiers téléchargés par défaut.

Option 1 - Via Terminal (Recommandé) :
1. Ouvrez Terminal (Applications > Utilitaires > Terminal)
2. Tapez : cd ~/Downloads
3. Tapez : chmod +x orbitai-tracker.command
4. Tapez : ./orbitai-tracker.command

Option 2 - Via Finder :
1. Ouvrez le Finder et allez dans Téléchargements
2. Faites un clic DROIT (ou Ctrl+clic) sur "orbitai-tracker.command"
3. Sélectionnez "Ouvrir" (pas double-clic)
4. Cliquez sur "Ouvrir" dans la boîte de dialogue qui apparaît
5. Si macOS demande confirmation, cliquez sur "Ouvrir"

Le script s'installera et se lancera automatiquement.

⚠️ Cette page vérifiera automatiquement le statut du tracking.`;

        if (window.confirm(launchMessage + '\n\nVoulez-vous ouvrir le dossier Téléchargements maintenant ?')) {
          // Ouvrir le dossier Téléchargements sur macOS
          window.open('x-apple-finder://Users/' + (window.navigator.userAgent.includes('Mac') ? '~' : '') + '/Downloads');
        }
      } else {
        const launchMessage = `Le script a été téléchargé dans votre dossier Téléchargements.

Pour le lancer :
1. Ouvrez l'Explorateur de fichiers
2. Allez dans Téléchargements
3. Double-cliquez sur "orbitai-tracker.bat"
4. Autorisez l'exécution si Windows demande confirmation

Le script s'installera et se lancera automatiquement.

⚠️ Cette page vérifiera automatiquement le statut du tracking.`;

        alert(launchMessage);
      }
      
      // Vérifier le statut immédiatement et ensuite plus fréquemment après le téléchargement
      setTimeout(() => {
        checkTrackingStatus();
        // Vérifier toutes les 5 secondes pendant 2 minutes après le téléchargement
        const checkInterval = setInterval(() => {
          checkTrackingStatus();
        }, 5000);
        
        setTimeout(() => {
          clearInterval(checkInterval);
        }, 120000); // Arrêter après 2 minutes
      }, 2000);
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(`Une erreur est survenue lors du téléchargement du script:\n\n${error.message || error}\n\nVeuillez réessayer ou contacter le support.`);
    }
  };

  const handleAnalyzeHistory = async () => {
    if (!onAnalyzeHistory) return;
    setIsAnalyzing(true);
    try {
      await onAnalyzeHistory();
      // Attendre un peu avant de rafraîchir pour que les données soient sauvegardées
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Erreur analyse:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="max-w-7xl mx-auto py-10">
        <div className="text-center text-slate-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-10">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-extrabold text-white italic tracking-tighter uppercase mb-2">
              Détection & Automatisation
            </h1>
            <p className="text-slate-400">
              Vue d'ensemble de vos tâches grises et automatisations
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Statut du tracking */}
            {trackingStatus && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border ${
                trackingStatus.isActive 
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-slate-800/50 border-slate-700 text-slate-400"
              }`}>
                <Activity size={16} className={trackingStatus.isActive ? "animate-pulse" : ""} />
                <span>{trackingStatus.message}</span>
                <button
                  onClick={checkTrackingStatus}
                  disabled={isCheckingStatus}
                  className="ml-2 p-1 hover:bg-white/10 rounded transition"
                  title="Actualiser"
                >
                  <RefreshCw size={12} className={isCheckingStatus ? "animate-spin" : ""} />
                </button>
              </div>
            )}
            
            {onAnalyzeHistory && (
              <button
                onClick={handleAnalyzeHistory}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm transition"
              >
                <RefreshCw size={16} className={isAnalyzing ? "animate-spin" : ""} />
                {isAnalyzing ? "Analyse en cours..." : "Analyser l'historique"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-violet-600/20 rounded-xl">
              <ListChecks size={24} className="text-violet-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{stats.total_tasks}</p>
          <p className="text-sm text-slate-400">Tâches détectées</p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-600/20 rounded-xl">
              <CheckCircle2 size={24} className="text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{stats.automated_tasks}</p>
          <p className="text-sm text-slate-400">Tâches automatisées</p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-600/20 rounded-xl">
              <Zap size={24} className="text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{stats.active_automations}</p>
          <p className="text-sm text-slate-400">Automatisations actives</p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-violet-600/20 rounded-xl">
              <Clock size={24} className="text-violet-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{stats.time_saved_hours.toFixed(1)}h</p>
          <p className="text-sm text-slate-400">Temps économisé</p>
        </div>
      </div>

      {/* Instructions pour le script de tracking */}
      {trackingStatus?.isActive ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-600/20 rounded-xl">
              <Activity size={24} className="text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">Tracking d'activité actif</h3>
              <p className="text-slate-400 text-sm mb-4">
                Le tracking est en cours d'exécution et collecte des données sur votre activité.
              </p>
              
              <button
                onClick={() => {
                  const message = `Pour arrêter le tracking :

1. Trouvez la fenêtre du terminal où le script tourne
2. Appuyez sur Ctrl+C dans cette fenêtre
3. Le tracking s'arrêtera immédiatement

⚠️ Si vous avez fermé la fenêtre du terminal, le script continue de tourner en arrière-plan. Dans ce cas :
- Sur macOS : Ouvrez "Activity Monitor", cherchez "python3" ou "activity-tracker", et arrêtez le processus
- Sur Windows : Ouvrez "Gestionnaire des tâches", cherchez "python.exe" ou "activity-tracker", et arrêtez le processus`;
                  alert(message);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm transition mb-3"
              >
                <StopCircle size={16} />
                Arrêter le tracking
              </button>
              <p className="text-xs text-slate-500">
                ℹ️ Le tracking s'arrête en fermant le terminal où il tourne ou en appuyant sur Ctrl+C.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-600/20 rounded-xl">
              <Activity size={24} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-2">Tracking d'activité inactif</h3>
              <p className="text-slate-400 text-sm mb-4">
                Pour détecter automatiquement les tâches grises basées sur votre activité, lancez le script de tracking.
              </p>
              
              {/* Bouton d'installation automatique */}
              {(detectedOS === 'macos' || detectedOS === 'windows') && (
                <div>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={handleDownloadAndInstall}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm transition"
                    >
                      <Play size={16} />
                      {hasDownloadedScript || trackingStatus?.hasEverTracked
                        ? "Lancer le tracking"
                        : "Télécharger et lancer le tracking"}
                    </button>
                    {(hasDownloadedScript || trackingStatus?.hasEverTracked) && (
                      <button
                        onClick={async () => {
                          if (!userId) {
                            alert("User ID manquant. Veuillez rafraîchir la page.");
                            return;
                          }
                          if (detectedOS !== 'macos' && detectedOS !== 'windows') return;
                          
                          try {
                            const response = await fetch(`/api/generate-tracker-script?userId=${userId}&os=${detectedOS}`);
                            if (!response.ok) {
                              throw new Error('Erreur lors du téléchargement');
                            }
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            const filename = detectedOS === 'macos' ? 'orbitai-tracker.command' : 'orbitai-tracker.bat';
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                            
                            alert(`Script téléchargé avec succès !\n\nLe fichier "${filename}" a été téléchargé dans votre dossier Téléchargements.`);
                          } catch (error: any) {
                            alert(`Erreur lors du téléchargement : ${error.message}`);
                          }
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition"
                        title="Télécharger à nouveau le script"
                      >
                        <Download size={16} />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    {hasDownloadedScript || trackingStatus?.hasEverTracked ? (
                      <>Le script est déjà téléchargé. Double-cliquez sur "orbitai-tracker.{detectedOS === 'macos' ? 'command' : 'bat'}" dans votre dossier Téléchargements pour le lancer.</>
                    ) : (
                      <>Le script sera téléchargé avec votre configuration. Il vous suffira de le lancer (double-clic) et d'autoriser les permissions système.</>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {detectedOS === 'macos' && (
                      <>⚠️ Assurez-vous d'avoir donné les permissions nécessaires dans les préférences système macOS.</>
                    )}
                    {detectedOS === 'windows' && (
                      <>⚠️ Vous devrez peut-être exécuter le script en tant qu'administrateur.</>
                    )}
                  </p>
                </div>
              )}

              {(detectedOS === 'linux' || detectedOS === 'unknown') && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <p className="text-slate-400 text-sm">
                    ⚠️ Le tracking d'activité est actuellement disponible uniquement pour macOS et Windows.
                    Le support Linux sera ajouté dans une future mise à jour.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tâches récentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Tâches récentes</h2>
          {stats.recent_tasks.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucune tâche détectée</p>
          ) : (
            <div className="space-y-3">
              {stats.recent_tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-white text-sm">{task.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{task.source}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      task.status === 'automated' ? 'bg-green-500/20 text-green-400' :
                      task.status === 'automating' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top automatisations */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Top automatisations</h2>
          {stats.top_automations.length === 0 ? (
            <p className="text-slate-400 text-sm">Aucune automatisation</p>
          ) : (
            <div className="space-y-3">
              {stats.top_automations.map((automation) => (
                <div
                  key={automation.id}
                  className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-white text-sm">{automation.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{automation.type}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold text-violet-400">
                        {automation.execution_count} exécutions
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        automation.status === 'active' ? 'bg-green-500/20 text-green-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {automation.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


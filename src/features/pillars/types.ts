/**
 * Types pour le système de piliers OrbitAI
 */

export type PillarId = 
  | 'copilot-transmission'
  | 'detection-automation'
  | 'decision-simulation'
  | 'emotional-ai'
  | 'client-synthesis';

export type Pillar = {
  id: PillarId;
  name: string;
  description: string;
  icon: string; // Nom de l'icône Lucide
  color: string; // Classe Tailwind pour la couleur
  enabled: boolean;
  route: string;
};

export const PILLARS: Pillar[] = [
  {
    id: 'copilot-transmission',
    name: 'Copilote IA & Transmission',
    description: 'Assistant qui facilite l\'onboarding, centralise le savoir interne et adapte ses explications au niveau de chaque collaborateur.',
    icon: 'GraduationCap',
    color: 'text-cyan-400',
    enabled: true, // Le seul activé pour le moment
    route: '/copilot',
  },
  {
    id: 'detection-automation',
    name: 'Détection & Automatisation',
    description: 'Détection proactive des tâches grises et proposition d\'automatisations ciblées pour faire gagner un temps considérable au quotidien.',
    icon: 'Sparkles',
    color: 'text-violet-400',
    enabled: true,
    route: '/automation',
  },
  {
    id: 'decision-simulation',
    name: 'Simulation décisionnelle',
    description: 'Analyse contextuelle et projection de scénarios pour aider les dirigeants à prendre des décisions rapides, éclairées et cohérentes.',
    icon: 'Brain',
    color: 'text-sky-400',
    enabled: true,
    route: '/decisions',
  },
  {
    id: 'emotional-ai',
    name: 'IA émotionnelle',
    description: 'Analyse fine des interactions pour prévenir les tensions, renforcer la collaboration et fluidifier la communication au sein des équipes.',
    icon: 'Users',
    color: 'text-rose-400',
    enabled: false,
    route: '/emotional',
  },
  {
    id: 'client-synthesis',
    name: 'Synthèse intelligente client',
    description: 'Agrégation automatique des retours multi-sources pour offrir une vision claire, structurée et actionnable de la voix client.',
    icon: 'BarChart2',
    color: 'text-emerald-400',
    enabled: false,
    route: '/client',
  },
];


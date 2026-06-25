// Copyright © 2026 OrbitSys. Tous droits réservés.

/**
 * Utilitaires pour les couleurs et labels des piliers
 */

import { type PillarId, PILLARS } from '../types';

export function getPillarColor(pillarId: PillarId): string {
  const pillar = PILLARS.find(p => p.id === pillarId);
  if (!pillar) return 'text-purple-400';
  
  // Convertir text-cyan-400 en cyan-400 pour les bordures
  return pillar.color.replace('text-', '');
}

export function getPillarBorderColor(pillarId: PillarId): string {
  const color = getPillarColor(pillarId);
  return `border-${color}`;
}

export function getPillarBgColor(pillarId: PillarId): string {
  const color = getPillarColor(pillarId);
  return `bg-${color}/20`;
}

export function getPillarLabel(pillarId: PillarId): string {
  const labels: Record<PillarId, string> = {
    'copilot-transmission': 'Knowledge Expert',
    'detection-automation': 'Automation Expert',
    'decision-simulation': 'Strategy Expert',
    'emotional-ai': 'HR Expert',
    'client-synthesis': 'Marketing Expert',
  };
  
  return labels[pillarId] || 'Operator';
}





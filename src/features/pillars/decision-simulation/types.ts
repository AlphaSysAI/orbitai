/**
 * Types pour le pilier Simulation Décisionnelle
 */

export type SimulationStatus = 
  | 'conversation'  // En cours de conversation pour comprendre le contexte
  | 'analyzing'     // Analyse en cours
  | 'ready'         // Simulation prête avec scénarios
  | 'saved';        // Sauvegardée

export type DecisionType = 'strategic' | 'operational' | 'both';

export type ScenarioType = 
  | 'optimistic'
  | 'pessimistic' 
  | 'realistic'
  | 'worst-case'
  | 'best-case';

export interface ConversationMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  metadata?: {
    questionType?: string;
    contextKey?: string;
  };
}

export interface Scenario {
  id: string;
  type: ScenarioType;
  title: string;
  description: string;
  probability?: number; // Pourcentage de probabilité
  metrics: {
    roi?: number;
    cost?: number;
    duration?: number; // en mois
    risk?: number; // 1-10
    impact?: number; // 1-10
  };
  swot?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  recommendations: string[];
  timeline?: {
    milestones: Array<{
      month: number;
      description: string;
    }>;
  };
}

export interface DecisionContext {
  question?: string;
  decisionType?: DecisionType;
  options?: string[];
  constraints?: string[];
  objectives?: string[];
  stakeholders?: string[];
  timeline?: string;
  budget?: string;
  documents?: Array<{
    id: string;
    name: string;
    content?: string;
  }>;
  historicalData?: string;
  marketContext?: string;
  currentMetrics?: Record<string, number>;
}

export interface DecisionSimulation {
  id: string;
  userId: string;
  title: string;
  status: SimulationStatus;
  createdAt: string;
  updatedAt: string;
  context: DecisionContext;
  conversation: ConversationMessage[];
  scenarios: Scenario[];
  selectedScenarios?: string[]; // IDs des scénarios à comparer
  notes?: string;
  tags?: string[];
}


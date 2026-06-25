// Copyright © 2026 OrbitSys. Tous droits réservés.

/**
 * Types pour le pilier Détection & Automatisation
 */

export type TaskSource = 'document' | 'history' | 'manual' | 'external';
export type TaskStatus = 'detected' | 'analyzing' | 'automating' | 'automated' | 'ignored';
export type AutomationType = 'email' | 'file' | 'webhook' | 'internal' | 'custom';
export type AutomationStatus = 'active' | 'paused' | 'archived' | 'error';
export type ExecutionStatus = 'success' | 'failed' | 'running' | 'cancelled';

export interface GrayTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  source: TaskSource;
  frequency_score: number;
  repetitiveness_score: number;
  time_estimate_minutes?: number;
  status: TaskStatus;
  metadata: Record<string, any>;
  ai_analysis?: string;
  created_at: string;
  updated_at: string;
  detected_at: string;
}

export interface TriggerConfig {
  type: 'schedule' | 'event' | 'condition' | 'webhook';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
    time?: string;
    days?: number[];
    cron?: string;
  };
  event?: {
    type: 'file_upload' | 'email_received' | 'document_created';
    conditions?: Record<string, any>;
  };
  condition?: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  };
  webhook?: {
    url: string;
    method: 'GET' | 'POST';
  };
}

export interface ActionConfig {
  type: AutomationType;
  email?: {
    to: string | string[];
    subject: string;
    body: string;
    template?: string;
    attachments?: string[];
  };
  file?: {
    operation: 'create' | 'move' | 'copy' | 'delete' | 'transform';
    source_path?: string;
    target_path?: string;
    format?: string;
    template?: string;
  };
  webhook?: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: any;
  };
  internal?: {
    action: string;
    params?: Record<string, any>;
  };
}

export interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: any;
  logic?: 'AND' | 'OR';
}

export interface Automation {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  type: AutomationType;
  status: AutomationStatus;
  trigger_config: TriggerConfig;
  action_config: ActionConfig;
  conditions: Condition[];
  related_task_id?: string;
  ai_suggested: boolean;
  execution_count: number;
  last_executed_at?: string;
  next_execution_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationExecution {
  id: string;
  automation_id: string;
  user_id: string;
  status: ExecutionStatus;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  error_message?: string;
  logs: string[];
}

export interface AutomationStats {
  total_tasks: number;
  automated_tasks: number;
  active_automations: number;
  total_executions: number;
  success_rate: number;
  time_saved_hours: number;
  recent_tasks: GrayTask[];
  top_automations: Array<Automation & { execution_count: number }>;
}






// Copyright © 2026 OrbitSys. Tous droits réservés.

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import type { GrayTask, Automation, AutomationExecution, AutomationStats, TriggerConfig, ActionConfig } from "../types";

export function useAutomation(userId: string | null) {
  const supabase = createClient();
  
  const [tasks, setTasks] = useState<GrayTask[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [activeTask, setActiveTask] = useState<GrayTask | null>(null);
  const [activeAutomation, setActiveAutomation] = useState<Automation | null>(null);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchTasks();
      fetchAutomations();
      fetchStats();
    }
  }, [userId]);

  const fetchTasks = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('gray_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('detected_at', { ascending: false });
    
    if (!error && data) {
      setTasks(data as GrayTask[]);
    }
  };

  const fetchAutomations = async () => {
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setAutomations(data.map(transformDbToAutomation));
    }
  };

  const transformDbToAutomation = (dbRow: any): Automation => ({
    id: dbRow.id,
    user_id: dbRow.user_id,
    name: dbRow.name,
    description: dbRow.description,
    type: dbRow.type,
    status: dbRow.status,
    trigger_config: dbRow.trigger_config || {},
    action_config: dbRow.action_config || {},
    conditions: dbRow.conditions || [],
    related_task_id: dbRow.related_task_id,
    ai_suggested: dbRow.ai_suggested || false,
    execution_count: dbRow.execution_count || 0,
    last_executed_at: dbRow.last_executed_at,
    next_execution_at: dbRow.next_execution_at,
    created_at: dbRow.created_at,
    updated_at: dbRow.updated_at,
  });

  const fetchStats = async () => {
    // Récupérer les statistiques agrégées
    const { data: tasksData } = await supabase
      .from('gray_tasks')
      .select('status')
      .eq('user_id', userId);
    
    const { data: automationsData } = await supabase
      .from('automations')
      .select('id, status, execution_count')
      .eq('user_id', userId);
    
    const { data: executionsData } = await supabase
      .from('automation_executions')
      .select('status')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(100);

    const { data: recentTasks } = await supabase
      .from('gray_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('detected_at', { ascending: false })
      .limit(5);

    if (tasksData && automationsData && executionsData) {
      const totalTasks = tasksData.length;
      const automatedTasks = tasksData.filter(t => t.status === 'automated').length;
      const activeAutomations = automationsData.filter(a => a.status === 'active').length;
      const totalExecutions = executionsData.length;
      const successCount = executionsData.filter(e => e.status === 'success').length;
      const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

      // Estimer le temps économisé (basé sur time_estimate_minutes des tâches automatisées)
      const timeSavedMinutes = tasks
        .filter((t) => t.status === 'automated')
        .reduce((sum, t) => sum + (t.time_estimate_minutes || 0), 0);
      const timeSavedHours = timeSavedMinutes / 60;

      // Top automatisations par nombre d'exécutions
      const topAutomations = automationsData
        .sort((a, b) => (b.execution_count || 0) - (a.execution_count || 0))
        .slice(0, 5)
        .map(a => {
          const automation = automations.find(au => au.id === a.id);
          return automation ? { ...automation, execution_count: a.execution_count || 0 } : null;
        })
        .filter(Boolean) as Array<Automation & { execution_count: number }>;

      setStats({
        total_tasks: totalTasks,
        automated_tasks: automatedTasks,
        active_automations: activeAutomations,
        total_executions: totalExecutions,
        success_rate: successRate,
        time_saved_hours: timeSavedHours,
        recent_tasks: (recentTasks || []) as GrayTask[],
        top_automations: topAutomations,
      });
    }
  };

  const createTask = async (task: Partial<GrayTask>): Promise<string | null> => {
    const { data, error } = await supabase
      .from('gray_tasks')
      .insert({
        user_id: userId,
        title: task.title || 'Nouvelle tâche',
        description: task.description,
        source: task.source || 'manual',
        frequency_score: task.frequency_score || 0,
        repetitiveness_score: task.repetitiveness_score || 0,
        time_estimate_minutes: task.time_estimate_minutes,
        status: task.status || 'detected',
        metadata: task.metadata || {},
        ai_analysis: task.ai_analysis,
      })
      .select()
      .single();
    
    if (!error && data) {
      // Enregistrer l'action
      try {
        await supabase
          .from('user_actions')
          .insert({
            user_id: userId,
            action_type: 'task_created',
            metadata: {
              task_id: data.id,
              source: task.source || 'manual',
            },
          });
      } catch (err) {
        // Échec silencieux
      }

      await fetchTasks();
      await fetchStats();
      return data.id;
    }
    return null;
  };

  const updateTask = async (taskId: string, updates: Partial<GrayTask>): Promise<boolean> => {
    const { error } = await supabase
      .from('gray_tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', userId);
    
    if (!error) {
      await fetchTasks();
      await fetchStats();
      return true;
    }
    return false;
  };

  const deleteTask = async (taskId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('gray_tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId);
    
    if (!error) {
      await fetchTasks();
      await fetchStats();
      return true;
    }
    return false;
  };

  const createAutomation = async (automation: Partial<Automation>): Promise<string | null> => {
    const { data, error } = await supabase
      .from('automations')
      .insert({
        user_id: userId,
        name: automation.name || 'Nouvelle automatisation',
        description: automation.description,
        type: automation.type || 'internal',
        status: automation.status || 'active',
        trigger_config: automation.trigger_config || {},
        action_config: automation.action_config || {},
        conditions: automation.conditions || [],
        related_task_id: automation.related_task_id,
        ai_suggested: automation.ai_suggested || false,
      })
      .select()
      .single();
    
    if (!error && data) {
      // Enregistrer l'action
      try {
        await supabase
          .from('user_actions')
          .insert({
            user_id: userId,
            action_type: 'automation_created',
            metadata: {
              automation_id: data.id,
              type: automation.type || 'internal',
              ai_suggested: automation.ai_suggested || false,
            },
          });
      } catch (err) {
        // Échec silencieux
      }

      await fetchAutomations();
      await fetchStats();
      return data.id;
    }
    return null;
  };

  const updateAutomation = async (automationId: string, updates: Partial<Automation>): Promise<boolean> => {
    const { error } = await supabase
      .from('automations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', automationId)
      .eq('user_id', userId);
    
    if (!error) {
      await fetchAutomations();
      await fetchStats();
      return true;
    }
    return false;
  };

  const deleteAutomation = async (automationId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', automationId)
      .eq('user_id', userId);
    
    if (!error) {
      await fetchAutomations();
      await fetchStats();
      return true;
    }
    return false;
  };

  const toggleAutomationStatus = async (automationId: string): Promise<boolean> => {
    const automation = automations.find(a => a.id === automationId);
    if (!automation) return false;

    const newStatus = automation.status === 'active' ? 'paused' : 'active';
    return updateAutomation(automationId, { status: newStatus });
  };

  const loadTask = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setActiveTask(task);
    }
  }, [tasks]);

  const loadAutomation = useCallback((automationId: string) => {
    const automation = automations.find(a => a.id === automationId);
    if (automation) {
      setActiveAutomation(automation);
    }
  }, [automations]);

  return {
    tasks,
    automations,
    activeTask,
    activeAutomation,
    stats,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomationStatus,
    loadTask,
    loadAutomation,
    refreshTasks: fetchTasks,
    refreshAutomations: fetchAutomations,
    refreshStats: fetchStats,
  };
}


"use client";

import { useState } from "react";
import { Plus, Trash2, FileText, Clock, History, Edit3, User, ListChecks } from "lucide-react";
import { GrayTask } from "../types";

interface TaskListProps {
  tasks: GrayTask[];
  activeTask: GrayTask | null;
  onTaskSelect: (taskId: string) => void;
  onTaskUpdate: (taskId: string, updates: Partial<GrayTask>) => Promise<boolean>;
  onTaskDelete: (taskId: string) => Promise<boolean>;
  onTaskCreate: (task: Partial<GrayTask>) => Promise<string | null>;
  isLoading: boolean;
}

export function TaskList({
  tasks,
  activeTask,
  onTaskSelect,
  onTaskUpdate,
  onTaskDelete,
  onTaskCreate,
  isLoading,
}: TaskListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    const id = await onTaskCreate({
      title: newTaskTitle,
      source: 'manual',
      status: 'detected',
    });
    if (id) {
      setNewTaskTitle("");
      setIsCreating(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'document':
        return <FileText size={16} className="text-blue-400" />;
      case 'history':
        return <History size={16} className="text-violet-400" />;
      case 'manual':
        return <User size={16} className="text-green-400" />;
      default:
        return <FileText size={16} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'automated':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'automating':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'analyzing':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'ignored':
        return 'bg-slate-700/50 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800/50 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-4xl font-extrabold text-white italic tracking-tighter uppercase">
            Tâches détectées
          </h1>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm transition"
          >
            <Plus size={16} />
            Nouvelle tâche
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl mb-6">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Titre de la tâche..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:border-violet-600"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTask();
              if (e.key === 'Escape') {
                setIsCreating(false);
                setNewTaskTitle("");
              }
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateTask}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm"
            >
              Créer
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewTaskTitle("");
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 p-12 rounded-2xl text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-slate-800/50 rounded-2xl">
              <ListChecks size={32} className="text-slate-500" />
            </div>
          </div>
          <p className="text-slate-400 text-lg font-medium mb-2">
            Aucune tâche détectée
          </p>
          <p className="text-slate-500 text-sm">
            Les tâches grises détectées par l'IA apparaîtront ici
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onTaskSelect(task.id)}
              className={`bg-slate-900/40 border p-6 rounded-2xl flex justify-between items-center group hover:bg-slate-900/80 transition-all cursor-pointer ${
                activeTask?.id === task.id
                  ? 'border-violet-500/40 bg-violet-600/10'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className="p-3 bg-violet-600/10 rounded-xl flex-shrink-0">
                  {getSourceIcon(task.source)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    <span className="text-xs text-slate-500 capitalize">{task.source}</span>
                    {task.time_estimate_minutes && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={12} />
                        {task.time_estimate_minutes} min
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Supprimer cette tâche ?")) {
                    onTaskDelete(task.id);
                  }
                }}
                className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


'use client';

import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import { formatDate } from '../../lib/date-time';
import { PriorityLevel } from '../../lib/types';

interface TasksViewProps {
  onOpenQuickAdd: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ onOpenQuickAdd }) => {
  const { tasks, toggleTask, deleteTask, addTask } = useDayBridge();
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const priorityColors: Record<PriorityLevel, string> = {
    urgent: 'bg-rose-950 text-rose-300 border-rose-800/60',
    high: 'bg-amber-50 text-amber-800 border-amber-800/60',
    medium: 'bg-sky-950 text-sky-800 border-sky-800/60',
    low: 'bg-slate-100 text-slate-700 border-slate-700/60',
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Title & Add Task */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Tasks & Preparation</h2>
          <p className="text-xs text-slate-600">
            One-tap completion, court prep checklists, and daily priorities
          </p>
        </div>
        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs min-h-[44px] transition shadow-md shadow-teal-100/70"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Task</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['pending', 'completed', 'all'] as const).map((tab) => {
          const isSelected = filter === tab;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold capitalize min-h-[44px] transition border ${
                isSelected
                  ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab} ({tasks.filter((t) => (tab === 'pending' ? !t.completed : tab === 'completed' ? t.completed : true)).length})
            </button>
          );
        })}
      </div>

      {/* Tasks List */}
      <div className="space-y-2.5">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`p-3.5 sm:p-4 rounded-2xl border transition ${
                task.completed
                  ? 'bg-slate-950/40 border-slate-200 opacity-60'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  onClick={() => toggleTask(task.id)}
                  className="flex items-center gap-3 flex-1 cursor-pointer min-h-[44px]"
                >
                  <div
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
                      task.completed
                        ? 'bg-teal-500 border-teal-400 text-slate-950'
                        : 'border-slate-600 bg-slate-50'
                    }`}
                  >
                    {task.completed && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          task.completed ? 'line-through text-slate-600' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                          priorityColors[task.priority]
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    {task.dueDate && (
                      <span className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-600" />
                        <span>Due {formatDate(task.dueDate)}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {task.subtasks && task.subtasks.length > 0 && (
                    <button
                      onClick={() =>
                        setExpandedTaskId((prev) => (prev === task.id ? null : task.id))
                      }
                      className="p-2 text-slate-600 hover:text-slate-800"
                      aria-label="Toggle subtasks"
                    >
                      {expandedTaskId === task.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-2 text-slate-600 hover:text-rose-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Subtasks */}
              {expandedTaskId === task.id && task.subtasks && task.subtasks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5 pl-8">
                  {task.subtasks.map((st) => (
                    <div key={st.id} className="text-xs text-slate-700 flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded border border-slate-600" />
                      <span>{st.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-10 bg-white border border-slate-200 rounded-3xl p-6">
            <CheckSquare className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h3 className="font-semibold text-slate-700 text-sm mb-1">
              {filter === 'completed' ? 'No completed tasks yet' : 'No pending tasks'}
            </h3>
            <p className="text-xs text-slate-600">Everything is up to date.</p>
          </div>
        )}
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import { ShieldCheck, Cloud, CloudOff, Plus, Lock } from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import { getTodayGreeting } from '../../lib/date-time';

interface HeaderProps {
  onOpenQuickAdd: () => void;
  onNavigate: (tab: string) => void;
  currentTab: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenQuickAdd, onNavigate, currentTab }) => {
  const { profile, syncStatus, isLiveSupabase } = useDayBridge();

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Brand & Greeting */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center shadow-lg shadow-teal-950/50">
            <span className="font-bold text-lg text-slate-950 tracking-tight">DB</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-slate-100 text-base leading-tight">DayBridge</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-800/50">
                Personal
              </span>
            </div>
            <p className="text-xs text-slate-400">{formattedDate}</p>
          </div>
        </div>

        {/* Status & Quick Action */}
        <div className="flex items-center gap-2">
          {/* Privacy / Sync status pill */}
          <button
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:bg-slate-850 hover:border-slate-700 transition"
            title={isLiveSupabase ? 'Connected to private Supabase database' : 'Private offline-first encrypted storage'}
          >
            {isLiveSupabase ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-teal-400" />
                <span className="hidden sm:inline text-teal-300 font-medium">Supabase Synced</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline text-slate-300">Private Local</span>
              </>
            )}
          </button>

          {/* Quick Add Button */}
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-semibold text-xs transition shadow-md shadow-teal-950/50"
            aria-label="Quick Add Obligation or Record"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="font-bold">Add</span>
          </button>
        </div>
      </div>
    </header>
  );
};

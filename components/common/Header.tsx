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
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Brand & Greeting */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-800 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-100/70">
            <span className="font-bold text-lg text-white tracking-tight">DB</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-slate-900 text-base leading-tight">DayBridge</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                Personal
              </span>
            </div>
            <p className="text-xs text-slate-600">{formattedDate}</p>
          </div>
        </div>

        {/* Status & Quick Action */}
        <div className="flex items-center gap-2">
          {/* Privacy / Sync status pill */}
          <button
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition"
            title={syncStatus === 'synced' ? 'Cloud records saved' : 'Changes may not be saved'}
          >
            {isLiveSupabase ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-teal-700" />
                <span className="hidden sm:inline text-teal-800 font-medium">{syncStatus === 'synced' ? 'Saved' : syncStatus === 'syncing' ? 'Saving…' : 'Check sync'}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline text-slate-700">Cloud unavailable</span>
              </>
            )}
          </button>

          {/* Quick Add Button */}
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 active:scale-95 text-white font-semibold text-xs transition shadow-md shadow-teal-100/70"
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

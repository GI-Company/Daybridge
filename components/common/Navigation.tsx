'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Wallet,
  Pill,
  Home,
  Menu,
  Scale,
  CheckSquare,
  FileText,
  PhoneCall,
  Settings,
  X,
} from 'lucide-react';

interface NavigationProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onTabChange }) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const mainTabs = [
    { id: 'today', label: 'Today', icon: Home },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'money', label: 'Money', icon: Wallet },
    { id: 'health', label: 'Health', icon: Pill },
  ];

  const moreTabs = [
    { id: 'court', label: 'Court & Classes', icon: Scale, description: 'Self-reported accountability checklist' },
    { id: 'tasks', label: 'Tasks & Prep', icon: CheckSquare, description: 'Priorities and appointment prep' },
    { id: 'review', label: 'Weekly Review', icon: FileText, description: 'Printable personal summary' },
    { id: 'resources', label: 'Contacts', icon: PhoneCall, description: 'Officer, therapist, clinic, emergency' },
    { id: 'settings', label: 'Settings', icon: Settings, description: 'Timezone, backups, quiet hours' },
  ];

  const isMoreActive = moreTabs.some((t) => t.id === currentTab);

  return (
    <>
      {/* Desktop Top Sub-nav Bar */}
      <div className="hidden md:block bg-slate-900 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <nav className="flex space-x-1 py-1.5" aria-label="Main Navigation">
            {mainTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center space-x-1 py-1.5">
            {moreTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-slate-800 text-teal-300 font-semibold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (44px min tap targets) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1 safe-area-bottom"
        aria-label="Mobile Navigation"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setShowMoreMenu(false);
                  onTabChange(tab.id);
                }}
                className={`flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-xl transition ${
                  isActive ? 'text-teal-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className="text-[11px] leading-tight">{tab.label}</span>
              </button>
            );
          })}

          {/* More Menu Trigger */}
          <button
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-xl transition ${
              isMoreActive || showMoreMenu ? 'text-teal-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Menu className="w-5 h-5 mb-0.5 stroke-[1.8]" />
            <span className="text-[11px] leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Drawer / Modal */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden flex flex-col justify-end">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl safe-area-bottom animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Additional Tools
              </h2>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {moreTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setShowMoreMenu(false);
                    }}
                    className={`flex items-center gap-3.5 p-3 rounded-xl text-left transition ${
                      isActive
                        ? 'bg-teal-500/15 border border-teal-500/30 text-teal-300'
                        : 'bg-slate-850/60 hover:bg-slate-800 text-slate-200 border border-slate-800/60'
                    }`}
                  >
                    <div className="p-2.5 rounded-lg bg-slate-800 text-teal-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{tab.label}</div>
                      <div className="text-xs text-slate-400">{tab.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

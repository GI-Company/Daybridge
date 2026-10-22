'use client';

import React, { useState } from 'react';
import { DayBridgeProvider } from '../lib/storage/store';
import { Header } from '../components/common/Header';
import { Navigation } from '../components/common/Navigation';
import { QuickAddModal } from '../components/common/QuickAddModal';
import { TodayView } from '../components/today/TodayView';
import { ScheduleView } from '../components/schedule/ScheduleView';
import { MoneyView } from '../components/money/MoneyView';
import { HealthView } from '../components/health/HealthView';
import { CourtView } from '../components/court/CourtView';
import { TasksView } from '../components/tasks/TasksView';
import { ReviewView } from '../components/review/ReviewView';
import { ResourcesView } from '../components/resources/ResourcesView';
import { SettingsView } from '../components/settings/SettingsView';

export default function HomePage() {
  const [currentTab, setCurrentTab] = useState<string>('today');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  return (
    <DayBridgeProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950">
        {/* Sticky Header */}
        <Header
          onOpenQuickAdd={() => setIsQuickAddOpen(true)}
          onNavigate={(tab) => setCurrentTab(tab)}
          currentTab={currentTab}
        />

        {/* Desktop & Mobile Navigation */}
        <Navigation
          currentTab={currentTab}
          onTabChange={(tab) => setCurrentTab(tab)}
        />

        {/* Main Content View Container */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:py-6">
          {currentTab === 'today' && (
            <TodayView
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            />
          )}

          {currentTab === 'schedule' && (
            <ScheduleView onOpenQuickAdd={() => setIsQuickAddOpen(true)} />
          )}

          {currentTab === 'money' && (
            <MoneyView onOpenQuickAdd={() => setIsQuickAddOpen(true)} />
          )}

          {currentTab === 'health' && (
            <HealthView onOpenQuickAdd={() => setIsQuickAddOpen(true)} />
          )}

          {currentTab === 'court' && (
            <CourtView
              onOpenQuickAdd={() => setIsQuickAddOpen(true)}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'tasks' && (
            <TasksView onOpenQuickAdd={() => setIsQuickAddOpen(true)} />
          )}

          {currentTab === 'review' && <ReviewView />}

          {currentTab === 'resources' && (
            <ResourcesView onOpenQuickAdd={() => setIsQuickAddOpen(true)} />
          )}

          {currentTab === 'settings' && <SettingsView />}
        </main>

        {/* Unified Quick Add Modal */}
        <QuickAddModal
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
        />
      </div>
    </DayBridgeProvider>
  );
}

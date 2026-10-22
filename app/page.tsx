'use client';

import React, { useState } from 'react';
import { DayBridgeProvider } from '../lib/storage/store';
import { InstallGate } from '../components/common/InstallGate';
import { SecureAppGate } from '../components/common/SecureAppGate';
import { UpdateMonitor } from '../components/common/UpdateMonitor';
import { Header } from '../components/common/Header';
import { Navigation } from '../components/common/Navigation';
import { QuickAddModal } from '../components/common/QuickAddModal';
import { TodayView } from '../components/today/TodayView';
import { ScheduleView } from '../components/schedule/ScheduleView';
import { LocationsView } from '../components/travel/LocationsView';
import { MoneyView } from '../components/money/MoneyView';
import { HealthView } from '../components/health/HealthView';
import { CourtView } from '../components/court/CourtView';
import { TasksView } from '../components/tasks/TasksView';
import { ReviewView } from '../components/review/ReviewView';
import { ResourcesView } from '../components/resources/ResourcesView';
import { SettingsView } from '../components/settings/SettingsView';

export default function HomePage() {
  return <><UpdateMonitor/><InstallGate><SecureAppGate>{userId => <PrivateWorkspace key={userId} userId={userId}/>}</SecureAppGate></InstallGate></>;
}

function PrivateWorkspace({userId}:{userId:string}) {
  const [currentTab, setCurrentTab] = useState<string>('today');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType,setQuickAddType]=useState<'event'|'medication'>('event');
  const openQuickAdd=(type:'event'|'medication'='event')=>{setQuickAddType(type);setIsQuickAddOpen(true)};

  return (
    <DayBridgeProvider userId={userId}>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-950">
        {/* Sticky Header */}
        <Header
          onOpenQuickAdd={() => openQuickAdd()}
          onNavigate={(tab) => setCurrentTab(tab)}
          currentTab={currentTab}
        />

        <div className="flex flex-1 min-w-0">
        {/* Collapsible navigation */}
        <Navigation
          currentTab={currentTab}
          onTabChange={(tab) => setCurrentTab(tab)}
        />

        {/* Main Content View Container */}
        <main id="daybridge-active-panel" role="tabpanel" aria-label={currentTab.charAt(0).toUpperCase()+currentTab.slice(1)} tabIndex={0} className="flex-1 min-w-0 max-w-5xl w-full mx-auto px-4 pb-24 pt-5 sm:px-6 sm:py-8">
          {currentTab === 'today' && (
            <TodayView
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenQuickAdd={() => openQuickAdd()}
            />
          )}

          {currentTab === 'schedule' && (
            <ScheduleView onOpenQuickAdd={() => openQuickAdd()} />
          )}

          {currentTab === 'locations' && <LocationsView />}

          {currentTab === 'money' && (
            <MoneyView onOpenQuickAdd={() => openQuickAdd()} />
          )}

          {currentTab === 'health' && (
            <HealthView onOpenQuickAdd={() => openQuickAdd('medication')} />
          )}

          {currentTab === 'court' && (
            <CourtView
              onOpenQuickAdd={() => openQuickAdd()}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'tasks' && (
            <TasksView onOpenQuickAdd={() => openQuickAdd()} />
          )}

          {currentTab === 'review' && <ReviewView />}

          {currentTab === 'resources' && (
            <ResourcesView onOpenQuickAdd={() => openQuickAdd()} />
          )}

          {currentTab === 'settings' && <SettingsView />}
        </main>
        </div>

        {/* Unified Quick Add Modal */}
        <QuickAddModal
          key={quickAddType+'-'+(isQuickAddOpen?'open':'closed')}
          initialType={quickAddType}
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
        />
      </div>
    </DayBridgeProvider>
  );
}

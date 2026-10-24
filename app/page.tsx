'use client';

import React, { useState } from 'react';
import {useNotificationNavigation} from '../lib/notifications/use-navigation';
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
import {AutomaticLiveTravel} from '../components/travel/AutomaticLiveTravel';
import { AutomaticTravelReminders } from '../components/travel/AutomaticTravelReminders';
import {NotificationAppBridge} from '../components/common/NotificationAppBridge';
import {NotificationConnection} from '../components/common/NotificationConnection';
import {NotificationRecordStatus} from '../components/common/NotificationRecordStatus';
import {BackgroundReadiness} from '../components/common/BackgroundReadiness';
import { MoneyView } from '../components/money/MoneyView';
import { HealthView } from '../components/health/HealthView';
import { CourtView } from '../components/court/CourtView';
import { TasksView } from '../components/tasks/TasksView';
import {NotesView} from '../components/notes/NotesView';
import { ReviewView } from '../components/review/ReviewView';
import { ResourcesView } from '../components/resources/ResourcesView';
import { SettingsView } from '../components/settings/SettingsView';

export default function HomePage() {
  return <><NotificationAppBridge/><UpdateMonitor/><InstallGate><SecureAppGate>{userId => <PrivateWorkspace key={userId} userId={userId}/>}</SecureAppGate></InstallGate></>;
}

function PrivateWorkspace({userId}:{userId:string}) {
  const {currentTab,navigate,target,notice}=useNotificationNavigation(userId);
  const [scheduleFocusDate,setScheduleFocusDate]=useState<string|undefined>();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDate,setQuickAddDate]=useState<string|undefined>(undefined);
  const [quickAddType,setQuickAddType]=useState<'event'|'medication'|'transaction'|'bill'|'task'|'contact'|undefined>(undefined);
  const openQuickAdd=(type?:'event'|'medication'|'transaction'|'bill'|'task'|'contact',date?:string)=>{setQuickAddType(type);setQuickAddDate(date);setIsQuickAddOpen(true)};

  return (
    <DayBridgeProvider userId={userId}>
      <AutomaticTravelReminders/>
      <AutomaticLiveTravel/>
      <NotificationConnection/>
      <BackgroundReadiness userId={userId} suppressed={!!(target?.account||target?.event||target?.task||target?.medication||target?.bill)}/>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-950">
        {/* Sticky Header */}
        <Header
          onOpenQuickAdd={() => openQuickAdd()}
          onNavigate={(tab) => navigate(tab)}
          currentTab={currentTab}
        />

        <div className="flex flex-1 min-w-0">
        {/* Collapsible navigation */}
        <Navigation
          currentTab={currentTab}
          onTabChange={(tab) => navigate(tab)}
        />

        {/* Main Content View Container */}
        <main id="daybridge-active-panel" role="tabpanel" aria-label={currentTab.charAt(0).toUpperCase()+currentTab.slice(1)} tabIndex={0} className="flex-1 min-w-0 max-w-5xl w-full mx-auto px-4 pb-24 pt-5 sm:px-6 sm:py-8">
          <NotificationRecordStatus target={target}/>
          {notice&&<p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{notice}</p>}
          {currentTab === 'today' && (
            <TodayView
              onNavigate={(tab) => navigate(tab)}
              onOpenQuickAdd={() => openQuickAdd()}
            />
          )}

          {currentTab === 'schedule' && (
            <ScheduleView focusEventId={target?.event} focusRevision={target?.revision} focusDate={target?.date||scheduleFocusDate} onOpenQuickAdd={date => openQuickAdd('event',date)} />
          )}

          {currentTab === 'locations' && <LocationsView focusEventId={target?.event} focusDate={target?.date} focusRevision={target?.revision} onOpenSchedule={date=>{setScheduleFocusDate(date);navigate('schedule')}} />}

          {currentTab === 'money' && (
            <MoneyView focusBillId={target?.bill} focusRevision={target?.revision} onOpenQuickAdd={type => openQuickAdd(type)} />
          )}

          {currentTab === 'health' && (
            <HealthView focusMedicationId={target?.medication} focusSlot={target?.slot} focusDate={target?.date} focusRevision={target?.revision} onOpenQuickAdd={() => openQuickAdd('medication')} />
          )}

          {currentTab === 'court' && (
            <CourtView
              onOpenQuickAdd={() => openQuickAdd()}
              onNavigate={(tab) => navigate(tab)}
            />
          )}

          {currentTab === 'notes' && <NotesView />}

          {currentTab === 'tasks' && (
            <TasksView focusTaskId={target?.task} focusRevision={target?.revision} onOpenQuickAdd={() => openQuickAdd('task')} />
          )}

          {currentTab === 'review' && <ReviewView />}

          {currentTab === 'resources' && (
            <ResourcesView onOpenQuickAdd={() => openQuickAdd('contact')} />
          )}

          {currentTab === 'settings' && <SettingsView />}
        </main>
        </div>

        {/* Unified Quick Add Modal */}
        <QuickAddModal
          key={quickAddType+'-'+(quickAddDate||'today')+'-'+(isQuickAddOpen?'open':'closed')}
          initialType={quickAddType}
          initialDate={quickAddDate}
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
        />
      </div>
    </DayBridgeProvider>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
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
import { AutomaticTravelReminders } from '../components/travel/AutomaticTravelReminders';
import {BackgroundReadiness} from '../components/common/BackgroundReadiness';
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
  const [scheduleFocusDate,setScheduleFocusDate]=useState<string|undefined>(undefined);
  useEffect(()=>{
    const openDeepLink=(raw:string)=>{
      try{
        const link=new URL(raw,window.location.origin);
        if(link.origin!==window.location.origin||link.pathname!=='/')return;
        const tab=link.searchParams.get('tab');
        if(tab!=='schedule')return;
        const day=link.searchParams.get('date');
        if(day&&/^\d{4}-\d{2}-\d{2}$/.test(day))setScheduleFocusDate(day);
        setCurrentTab('schedule');
      }catch{/* Ignore malformed push links. */}
    };
    openDeepLink(window.location.href);
    const onMessage=(event:MessageEvent)=>{
      if(event.data?.type==='DAYBRIDGE_TRAVEL_NOTIFICATION'&&
        typeof event.data?.url==='string')openDeepLink(event.data.url);
    };
    const onPop=()=>openDeepLink(window.location.href);
    navigator.serviceWorker?.addEventListener('message',onMessage);
    window.addEventListener('popstate',onPop);
    return()=>{
      navigator.serviceWorker?.removeEventListener('message',onMessage);
      window.removeEventListener('popstate',onPop);
    };
  },[]);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDate,setQuickAddDate]=useState<string|undefined>(undefined);
  const [quickAddType,setQuickAddType]=useState<'event'|'medication'|'transaction'|'bill'|'task'|'contact'|undefined>(undefined);
  const openQuickAdd=(type?:'event'|'medication'|'transaction'|'bill'|'task'|'contact',date?:string)=>{setQuickAddType(type);setQuickAddDate(date);setIsQuickAddOpen(true)};

  return (
    <DayBridgeProvider userId={userId}>
      <AutomaticTravelReminders/>
      <BackgroundReadiness userId={userId}/>
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
            <ScheduleView focusDate={scheduleFocusDate} onOpenQuickAdd={date => openQuickAdd('event',date)} />
          )}

          {currentTab === 'locations' && <LocationsView />}

          {currentTab === 'money' && (
            <MoneyView onOpenQuickAdd={type => openQuickAdd(type)} />
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
            <TasksView onOpenQuickAdd={() => openQuickAdd('task')} />
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

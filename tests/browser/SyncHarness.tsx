'use client';
import {useMemo,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {DayBridgeProvider,useDayBridge} from '../../lib/storage/store';
import {SignOutCard} from '../../components/common/SignOutCard';
import {Header} from '../../components/common/Header';
import {SyncRecovery} from '../../components/common/SyncRecovery';
import {sharedBackend} from './SecurityHarness';
function Workspace({backend}:{backend:SupabaseClient}){
 const data=useDayBridge();const [draft,setDraft]=useState(''),[out,setOut]=useState(false);
 if(out)return <p>Signed out safely</p>;
 return <><Header onOpenQuickAdd={()=>{}} onNavigate={()=>{}} currentTab="settings"/><p data-testid="sync-status">{data.syncStatus}</p><p data-testid="sync-issue">{data.syncIssue}</p><p data-testid="name">{data.profile.fullName}</p><pre data-testid="sync-records">{JSON.stringify(data.tasks)}</pre>
 <button onClick={()=>data.addTask({title:'Task from '+new URLSearchParams(location.search).get('device'),priority:'medium',isRecurring:false,subtasks:[]})}>Add device task</button>
 <button onClick={()=>data.updateProfile({fullName:'Name from '+new URLSearchParams(location.search).get('device')})}>Change name</button>
 <label>Appointment draft<input aria-label="Appointment draft" value={draft} data-daybridge-draft={draft?'true':undefined} onChange={event=>setDraft(event.target.value)}/></label>
 <SyncRecovery userId="synthetic-shared"/><SignOutCard backend={backend} onSignedOut={()=>setOut(true)}/></>;
}
export function SyncHarness(){const backend=useMemo(()=>sharedBackend('synthetic-shared'),[]);return <DayBridgeProvider userId="synthetic-shared" backend={backend}><Workspace backend={backend}/></DayBridgeProvider>;}

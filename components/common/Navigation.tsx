'use client';

import React, { useEffect, useState } from 'react';
import { CalendarDays, Wallet, Pill, House, MapPinned, Menu, Scale, CheckSquare, FileText, ContactRound, Settings, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

type TabId = 'today' | 'schedule' | 'money' | 'health' | 'locations' | 'court' | 'tasks' | 'review' | 'resources' | 'settings';
interface NavigationProps { currentTab: string; onTabChange: (tab: string) => void }
const mainTabs = [
 { id:'today', label:'Today', icon:House },
 { id:'schedule', label:'Schedule', icon:CalendarDays },
 { id:'health', label:'Medications', icon:Pill },
 { id:'locations', label:'Locations & maps', icon:MapPinned },
 { id:'money', label:'Budget', icon:Wallet },
] as const;
const groups = [
 { name:'Accountability & Planning', entries:[
   { id:'court', label:'Court & classes', icon:Scale },
   { id:'tasks', label:'Tasks & preparation', icon:CheckSquare },
   { id:'review', label:'Weekly review', icon:FileText },
 ]},
 { name:'Personal tools', entries:[
   { id:'resources', label:'Contacts & resources', icon:ContactRound },
   { id:'settings', label:'Settings & security', icon:Settings },
 ]}
] as const;

export function Navigation({ currentTab, onTabChange }:NavigationProps) {
 const [open,setOpen]=useState(false);
 const [collapsed,setCollapsed]=useState(false);
 const [expanded,setExpanded]=useState<Record<string,boolean>>({'Accountability & Planning':false,'Personal tools':false});
 useEffect(()=>{ if(!open) return; const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);},[open]);
 const choose=(id:TabId)=>{onTabChange(id);setOpen(false)};
 const menu=(prefix:string)=>(
   <nav aria-label="DayBridge sections" className="flex flex-col gap-2 p-3">
    <div role="tablist" aria-label="Primary sections" className="flex flex-col gap-1">
      {mainTabs.map(({id,label,icon:Icon})=>(
       <button key={id} id={prefix+'-'+id} type="button" role="tab"
        aria-selected={currentTab===id} aria-controls="daybridge-active-panel"
        tabIndex={currentTab===id?0:-1}
        onClick={()=>choose(id)}
        onKeyDown={e=>{const keys=['ArrowDown','ArrowUp','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const index=mainTabs.findIndex(t=>t.id===id);const next=e.key==='Home'?0:e.key==='End'?mainTabs.length-1:(index+(e.key==='ArrowDown'?1:-1)+mainTabs.length)%mainTabs.length;choose(mainTabs[next].id);document.getElementById(prefix+'-'+mainTabs[next].id)?.focus();}}
        title={label}
        className={'flex items-center rounded-xl gap-3 px-3 py-2.5 text-left text-sm font-semibold outline-offset-2 transition-colors '+(currentTab===id?'bg-teal-50 text-teal-900 border border-teal-200':'text-slate-700 hover:bg-slate-100 border border-transparent')}>
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0"/>
        {(!collapsed||prefix==='mobile')&&<span>{label}</span>}
       </button>
      ))}
    </div>
    <div className="mt-3 border-t border-slate-200 pt-3 space-y-2">
      {groups.map(group=>(
       <section key={group.name}>
        {(!collapsed||prefix==='mobile')&&<button type="button" onClick={()=>setExpanded(p=>({...p,[group.name]:!p[group.name]}))}
          aria-expanded={!!expanded[group.name]} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
          {group.name}<ChevronDown className={'h-4 w-4 transition-transform '+(expanded[group.name]?'':'-rotate-90')}/>
        </button>}
        {(expanded[group.name]||collapsed&&prefix==='desktop')&&<div className="space-y-1">
          {group.entries.map(({id,label,icon:Icon})=>(
           <button type="button" key={id} title={label} aria-current={currentTab===id?'page':undefined}
            onClick={()=>choose(id)} className={'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors '+(currentTab===id?'bg-teal-50 border border-teal-200 text-teal-900 font-semibold':'text-slate-700 hover:bg-slate-100 border border-transparent')}>
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0"/>{(!collapsed||prefix==='mobile')&&<span>{label}</span>}
           </button>
          ))}
        </div>}
       </section>
      ))}
    </div>
   </nav>
 );
 return <>
  <aside className={'hidden lg:flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 '+(collapsed?'w-[76px]':'w-[248px]')} aria-label="Sidebar">
    <div className="sticky top-[72px] flex flex-col">
     <button type="button" className="mx-3 my-3 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={()=>setCollapsed(!collapsed)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} aria-expanded={!collapsed}>
      {collapsed?<ChevronRight className="h-5 w-5"/>:<><ChevronLeft className="h-5 w-5"/>Collapse</>}
     </button>{menu('desktop')}
    </div>
  </aside>
  <button type="button" onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className="lg:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-teal-800 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-teal-900">
   <Menu className="h-5 w-5"/> Menu
  </button>
  {open&&<div className="fixed inset-0 z-50 lg:hidden">
    <button type="button" aria-label="Close navigation" onClick={()=>setOpen(false)} className="absolute inset-0 h-full w-full bg-slate-900/45"/>
    <aside role="dialog" aria-modal="true" aria-label="Navigation menu" onKeyDown={event=>{
      if(event.key!=='Tab')return;
      const focusables=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      const first=focusables[0],last=focusables[focusables.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }} className="absolute inset-y-0 left-0 w-[min(88vw,340px)] overflow-y-auto border-r border-slate-200 bg-white shadow-2xl">
     <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
      <strong className="text-base text-slate-900">DayBridge menu</strong>
      <button type="button" autoFocus onClick={()=>setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"><X className="h-5 w-5"/></button>
     </div>{menu('mobile')}
    </aside>
  </div>}
 </>;
}

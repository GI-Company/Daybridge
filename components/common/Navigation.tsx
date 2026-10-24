'use client';

import React,{useEffect,useRef,useState} from 'react';
import {CalendarDays,Wallet,House,MapPinned,Scale,CheckSquare,FileText,
  ContactRound,Settings,ChevronDown,X,Grid2X2,Pill} from 'lucide-react';

interface NavigationProps {currentTab:string;onTabChange:(tab:string)=>void}

const primary=[
 {id:'today',label:'Today',icon:House},
 {id:'schedule',label:'Schedule',icon:CalendarDays},
 {id:'tasks',label:'Tasks',icon:CheckSquare},
 {id:'money',label:'Budget',icon:Wallet},
] as const;
const secondary=[
 {id:'notes',label:'Sticky notes',icon:FileText,description:'Colorful private booklets'},
 {id:'health',label:'Medications',icon:Pill,description:'Doses and refills'},
 {id:'locations',label:'Locations & maps',icon:MapPinned,description:'Saved places and travel'},
 {id:'court',label:'Court & classes',icon:Scale,description:'Obligations and attendance'},
 {id:'review',label:'Weekly review',icon:FileText,description:'Review your progress'},
 {id:'resources',label:'Contacts & resources',icon:ContactRound,description:'People and helpful resources'},
 {id:'settings',label:'Settings & security',icon:Settings,description:'Preferences and privacy'},
] as const;

export function Navigation({currentTab,onTabChange}:NavigationProps){
 const [moreOpen,setMoreOpen]=useState(false);
 const [desktopMore,setDesktopMore]=useState(false);
 const moreButton=useRef<HTMLButtonElement>(null);
 const hasSecondary=secondary.some(section=>section.id===currentTab);
 const choose=(id:string)=>{
   onTabChange(id);
   setMoreOpen(false);
 };
 useEffect(()=>{
  if(!moreOpen)return;
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMoreOpen(false);moreButton.current?.focus();}};
  document.addEventListener('keydown',escape);
  return()=>document.removeEventListener('keydown',escape);
 },[moreOpen]);

 return <>
  <aside className="hidden lg:block w-[224px] shrink-0 border-r border-slate-200 bg-white" aria-label="Sidebar">
   <nav aria-label="DayBridge navigation" className="sticky top-[76px] space-y-2 p-3">
    <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Main</p>
    {primary.map(({id,label,icon:Icon})=>
     <button type="button" key={id} onClick={()=>choose(id)} aria-current={currentTab===id?'page':undefined}
      className={'flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-semibold '+
       (currentTab===id?'border-teal-200 bg-teal-50 text-teal-950':'border-transparent text-slate-700 hover:bg-slate-50')}>
      <Icon aria-hidden="true" className="h-5 w-5"/>{label}
     </button>
    )}
    <div className="border-t border-slate-200 pt-2">
     <button type="button" aria-expanded={desktopMore||hasSecondary}
      onClick={()=>setDesktopMore(v=>!v)}
      className={'flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 text-sm font-semibold '+
        (hasSecondary?'bg-teal-50 text-teal-950':'text-slate-700 hover:bg-slate-50')}>
      <span className="flex items-center gap-3"><Grid2X2 className="h-5 w-5"/>More</span>
      <ChevronDown className={'h-4 w-4 transition-transform '+(desktopMore||hasSecondary?'rotate-180':'')}/>
     </button>
     {(desktopMore||hasSecondary)&&<div className="mt-1 space-y-1 pl-2">
      {secondary.map(({id,label,icon:Icon})=>
       <button type="button" key={id} onClick={()=>choose(id)} aria-current={currentTab===id?'page':undefined}
        className={'flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-left text-sm '+
         (currentTab===id?'bg-teal-50 font-semibold text-teal-950':'text-slate-700 hover:bg-slate-50')}>
        <Icon aria-hidden="true" className="h-4 w-4"/>{label}
       </button>)}
     </div>}
    </div>
   </nav>
  </aside>

  <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-3px_20px_rgba(15,23,42,.08)] backdrop-blur lg:hidden">
    {primary.map(({id,label,icon:Icon})=>
     <button key={id} type="button" onClick={()=>choose(id)} aria-current={currentTab===id?'page':undefined}
      className={'flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold '+
       (currentTab===id?'text-teal-900':'text-slate-600')}>
      <Icon aria-hidden="true" className="h-5 w-5"/><span>{label}</span>
     </button>)}
    <button type="button" ref={moreButton} onClick={()=>setMoreOpen(true)}
      aria-haspopup="dialog" aria-expanded={moreOpen} aria-current={hasSecondary?'page':undefined}
      className={'flex min-h-[64px] flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold '+
       (hasSecondary?'text-teal-900':'text-slate-600')}>
      <Grid2X2 aria-hidden="true" className="h-5 w-5"/><span>More</span>
    </button>
  </nav>

  {moreOpen&&<div className="fixed inset-0 z-50 lg:hidden">
   <button aria-label="Close more sections" type="button" onClick={()=>setMoreOpen(false)}
    className="absolute inset-0 h-full w-full bg-slate-900/45"/>
   <div role="dialog" aria-modal="true" aria-label="More DayBridge sections"
    onKeyDown={event=>{
     if(event.key!=='Tab')return;
     const focusables=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]'));
     const first=focusables[0],last=focusables[focusables.length-1];
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }}
    className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-2xl">
    <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
      <h2 className="text-lg font-bold text-slate-950">More</h2>
      <button autoFocus type="button" aria-label="Close more menu"
        onClick={()=>{setMoreOpen(false);moreButton.current?.focus();}}
        className="rounded-xl border border-slate-200 p-2 text-slate-700"><X className="h-5 w-5"/></button>
    </div>
    <div className="grid grid-cols-2 gap-3 p-4">
     {secondary.map(({id,label,icon:Icon,description})=>
      <button key={id} type="button" onClick={()=>choose(id)}
       className={'flex min-h-[112px] flex-col items-start gap-1.5 rounded-2xl border p-3 text-left '+
        (currentTab===id?'border-teal-300 bg-teal-50':'border-slate-200 bg-white hover:bg-slate-50')}>
        <Icon aria-hidden="true" className="h-5 w-5 text-teal-800"/>
        <strong className="text-sm text-slate-950">{label}</strong>
        <span className="text-xs text-slate-600">{description}</span>
      </button>)}
    </div>
   </div>
  </div>}
 </>;
}

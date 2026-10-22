'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, ShieldCheck } from 'lucide-react';
interface InstallPrompt extends Event { prompt:()=>Promise<void>; userChoice:Promise<{outcome:string}> }
function standalone(){
 if(typeof window==='undefined')return false;
 return window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & {standalone?:boolean}).standalone;
}
export function InstallGate({children}:{children:React.ReactNode}){
 const [ready,setReady]=useState<boolean|null>(null);
 const [prompt,setPrompt]=useState<InstallPrompt|null>(null);
 const [ios,setIos]=useState(false);
 useEffect(()=>{
  const refresh=()=>setReady(standalone());
  refresh();
  setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
  const capture=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt)};
  window.addEventListener('beforeinstallprompt',capture);
  window.addEventListener('appinstalled',refresh);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  return()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[]);
 useEffect(()=>{if(ready&&'serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}},[ready]);
 if(ready===null) return <div className="min-h-screen bg-slate-50"/>;
 if(ready)return <>{children}</>;
 return <main className="min-h-screen flex items-center justify-center bg-slate-50 px-5 py-8">
  <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
   <div className="mb-5 inline-flex rounded-2xl bg-teal-50 p-4 text-teal-800"><Smartphone className="h-8 w-8"/></div>
   <h1 className="text-2xl font-bold tracking-tight text-slate-950">Install DayBridge to continue</h1>
   <p className="mt-3 text-sm leading-6 text-slate-700">DayBridge is designed for private, everyday use as a home-screen app. Install it first, then sign in. This is an installation requirement—not a request for access to your photos, contacts or location.</p>
   {prompt?<button type="button" onClick={async()=>{await prompt.prompt();await prompt.userChoice;setPrompt(null);setReady(standalone())}} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-3 font-semibold text-white hover:bg-teal-900"><Download className="h-5 w-5"/>Install app</button>:
    <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
     {ios?'On iPhone or iPad, use the browser Share menu, choose Add to Home Screen, then open DayBridge from the new icon.':'Use the browser menu and choose Install app or Add to Home screen, then open DayBridge from your app icon. Android Chrome and Samsung Internet are recommended.'}
    </div>}
   <div className="mt-5 flex items-start gap-2 text-xs text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>No personal data is available on this installation screen. Browsers without installation support cannot access the private workspace.</div>
   <button type="button" onClick={()=>setReady(standalone())} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">I've installed it — check again</button>
  </section>
 </main>;
}

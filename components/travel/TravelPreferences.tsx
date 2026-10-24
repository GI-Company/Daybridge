'use client';
import React,{useEffect,useState} from 'react';
import {createClient} from '../../lib/supabase/client';
import {defaults,type TravelPrefs} from '../../lib/travel/types';
type Place={lat:number;lon:number;label:string};
const client=createClient();
export function TravelPreferencesCard(){
 const [prefs,setPrefs]=useState<TravelPrefs>(defaults);
 const [loaded,setLoaded]=useState(!client),[message,setMessage]=useState(''),[address,setAddress]=useState(''),[options,setOptions]=useState<Place[]>([]);
 useEffect(()=>{let active=true;client?.from('travel_preferences').select('*').maybeSingle().then(({data,error}: {data:Partial<TravelPrefs>|null;error:unknown})=>{if(!active)return;if(data)setPrefs({...defaults,...data});if(error)setMessage('Travel settings could not be loaded.');setLoaded(true)});return()=>{active=false}},[]);
 async function save(next:TravelPrefs){if(!client)return;setPrefs(next);setMessage('Saving…');const {data}=await client.auth.getUser();if(!data.user)return setMessage('Sign in required');const {error}=await client.from('travel_preferences').upsert({...next,user_id:data.user.id,updated_at:new Date().toISOString()},{onConflict:'user_id'});setMessage(error?'Save failed; check your connection.':'Saved.');if(!error)window.dispatchEvent(new Event('daybridge:travel-prefs-updated'));}
 async function search(){setMessage('Searching…');const response=await fetch('/api/travel/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address})}).catch(()=>null);if(!response?.ok)return setMessage('Lookup unavailable.');const data=await response.json();setOptions(data.results||[]);setMessage('Select the correct result.');}
 function saveCurrent(){if(!navigator.geolocation)return setMessage('GPS unavailable.');navigator.geolocation.getCurrentPosition(p=>{void save({...prefs,saved_origin_label:'Approved current position',saved_origin_lat:p.coords.latitude,saved_origin_lon:p.coords.longitude})},()=>setMessage('Location permission declined or unavailable.'),{timeout:10000,maximumAge:60000})}
 if(!loaded)return <section role="status" className="rounded-2xl bg-white p-4">Loading travel settings…</section>;
 return <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4" aria-labelledby="travel-title">
 <h3 id="travel-title" className="font-bold text-lg text-slate-900">Travel & departure</h3>
 <p className="text-sm text-slate-700">Current location starts automatically after you allow GPS. Live departure alerts use a fresh location from the same device while DayBridge is open. When it is closed, appointment reminders continue; open them to refresh travel timing. An explicitly selected saved-location forecast is a separate planning option.</p>
 {([['navigation_enabled','Navigation available'],['traffic_notifications','Traffic and departure notifications'],['lockscreen_private','Private lock-screen notifications']] as const).map(([key,label])=><label key={key} className="flex items-center justify-between gap-3 text-sm text-slate-800"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-teal-800" checked={prefs[key]} onChange={e=>void save({...prefs,[key]:e.target.checked})}/></label>)}
 <label className="block text-sm font-semibold text-slate-800">Mode<select value={prefs.travel_mode} onChange={e=>void save({...prefs,travel_mode:e.target.value as TravelPrefs['travel_mode']})} className="block mt-1 p-3 w-full rounded-xl border border-slate-300 bg-white"><option value="car">Driving</option><option value="pedestrian">Walking</option><option value="bicycle">Cycling</option></select></label>
 <label className="block text-sm font-semibold text-slate-800">Arrive early: {prefs.arrival_buffer_minutes} minutes<input type="range" min="0" max="60" step="5" className="block w-full accent-teal-800" value={prefs.arrival_buffer_minutes} onChange={e=>void save({...prefs,arrival_buffer_minutes:Number(e.target.value)})}/></label>
 <p className="text-xs text-slate-600">Appointments can specify a larger early-arrival buffer.</p>
  <p className="text-xs leading-5 text-slate-600">Each appointment and task has its own reminder lead time. Set it when adding the item, or edit it from the Schedule details.</p>

 <fieldset className="space-y-2"><legend className="font-semibold text-sm text-slate-800">Default starting location</legend>
 <label className="flex items-center gap-2 text-sm"><input type="radio" name="travel-origin" checked={prefs.origin_kind==='current'} onChange={()=>void save({...prefs,origin_kind:'current'})}/>Current location automatically (default)</label>
 <label className="flex items-center gap-2 text-sm"><input type="radio" name="travel-origin" checked={prefs.origin_kind==='saved'} onChange={()=>void save({...prefs,origin_kind:'saved'})}/>Saved-location forecast (explicit planning option)</label></fieldset>
 <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-950 p-3 text-xs">{prefs.origin_kind==='current'?'Current-location mode: old saved coordinates are never substituted for GPS.':prefs.saved_origin_lat===null?'Choose a saved origin for this forecast.':'Planning forecast from: '+(prefs.saved_origin_label||'saved coordinate')}</div>
 <label htmlFor="origin-address" className="text-sm font-semibold">Approve a saved origin address</label>
 <div className="flex gap-2"><input id="origin-address" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Street address, city, state" className="min-w-0 flex-1 p-3 rounded-xl border border-slate-300" /><button type="button" disabled={address.length<6} onClick={()=>void search()} className="px-3 rounded-xl bg-teal-800 text-white disabled:opacity-50">Find</button></div>
 {options.map((opt,i)=><button type="button" key={i} onClick={()=>{void save({...prefs,saved_origin_label:opt.label,saved_origin_lat:opt.lat,saved_origin_lon:opt.lon});setOptions([])}} className="block w-full p-3 text-left rounded-xl border border-slate-300">{opt.label}</button>)}
 <button type="button" onClick={saveCurrent} className="rounded-xl border border-slate-300 p-3 text-sm font-medium">Save my current location as an approved origin</button>
 {prefs.saved_origin_lat!==null&&<button type="button" onClick={()=>void save({...prefs,origin_kind:'current',saved_origin_label:null,saved_origin_lat:null,saved_origin_lon:null})} className="block text-sm underline text-rose-700">Clear saved origin</button>}
 {message&&<p role="status" className="text-sm text-slate-700">{message}</p>}
 </section>;
}

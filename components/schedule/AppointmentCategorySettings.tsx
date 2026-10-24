'use client';
import {useState} from 'react';
import {useDayBridge} from '../../lib/storage/store';
import {appointmentCategories} from '../../lib/appointment-categories';
import type {AppointmentCategory} from '../../lib/types';
function CategoryEditor({category,onSave,onRemove,canRemove}:{category:AppointmentCategory;onSave:(label:string,color:string)=>void;onRemove:()=>void;canRemove:boolean}){
 const [label,setLabel]=useState(category.label),[color,setColor]=useState(category.color);
 return <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
  <label className="min-w-[140px] flex-1 text-xs font-semibold text-slate-700">Category name<input aria-label={'Name for '+category.label} maxLength={40} value={label} onChange={e=>setLabel(e.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"/></label>
  <label className="text-xs font-semibold text-slate-700">Color<input aria-label={'Color for '+category.label} type="color" value={color} onChange={e=>setColor(e.target.value)} className="mt-1 block h-11 w-12 rounded-lg border border-slate-300 bg-white"/></label>
  <button type="button" onClick={()=>onSave(label,color)} disabled={!label.trim()||(label.trim()===category.label&&color===category.color)} className="min-h-11 rounded-lg border border-teal-300 px-3 text-xs font-semibold text-teal-900 disabled:opacity-50">Save {category.label}</button>
  <button type="button" disabled={!canRemove} onClick={onRemove} className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs text-slate-700 disabled:opacity-50">Remove {category.label}</button>
 </div>;
}
export function AppointmentCategorySettings(){
 const {profile,updateProfile}=useDayBridge();const categories=appointmentCategories(profile),active=categories.filter(c=>!c.hidden);
 const [name,setName]=useState(''),[color,setColor]=useState('#0f766e'),[message,setMessage]=useState('');
 function save(items:AppointmentCategory[]){updateProfile({appointmentCategories:items});setMessage('Calendar key saved. Existing appointments are preserved.');}
 function valid(label:string,id?:string){if(categories.some(c=>c.id!==id&&c.label.toLowerCase()===label.trim().toLowerCase())){setMessage('Choose a unique category name, or restore its removed entry.');return false;}return Boolean(label.trim());}
 function add(){if(!valid(name))return;const category:AppointmentCategory={id:`custom_${crypto.randomUUID()}`,label:name.trim().slice(0,40),color};save([...categories,category]);setName('');}
 return <details className="border-t border-slate-200 p-3" aria-label="Customize calendar key">
  <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-teal-900">Customize calendar key</summary>
  <div className="mt-2 space-y-3">
   <p className="text-xs leading-5 text-slate-600">Choose the categories that suit your life. Removing a category hides it from the key and new appointments; existing appointments and reminders stay intact. You can restore it below.</p>
   {active.map(category=><CategoryEditor key={[category.id,category.label,category.color].join(':')} category={category} canRemove={active.length>1}
    onSave={(label,color)=>{if(valid(label,category.id))save(categories.map(c=>c.id===category.id?{...c,label:label.trim().slice(0,40),color}:c));}}
    onRemove={()=>save(categories.map(c=>c.id===category.id?{...c,hidden:true}:c))}/>)}
   <div className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
    <label className="min-w-[160px] flex-1 text-xs font-semibold text-slate-700">New category name<input value={name} onChange={e=>setName(e.target.value)} maxLength={40} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"/></label>
    <label className="text-xs font-semibold text-slate-700">New category color<input type="color" value={color} onChange={e=>setColor(e.target.value)} className="mt-1 block h-11 w-12 rounded-lg border border-slate-300 bg-white"/></label>
    <button type="button" disabled={!name.trim()||categories.length>=60} onClick={add} className="min-h-11 rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white disabled:opacity-50">Add category</button>
   </div>
   {categories.some(c=>c.hidden)&&<div className="space-y-2"><p className="text-xs font-semibold text-slate-700">Removed categories</p><div className="flex flex-wrap gap-2">{categories.filter(c=>c.hidden).map(category=><button type="button" key={category.id} onClick={()=>save(categories.map(c=>c.id===category.id?{...c,hidden:false}:c))} className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs text-slate-700">Restore {category.label}</button>)}</div></div>}
   {message&&<p role="status" className="text-xs text-teal-900">{message}</p>}
  </div>
 </details>;
}

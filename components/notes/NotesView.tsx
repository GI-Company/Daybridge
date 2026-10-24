'use client';
import React,{useEffect,useRef,useState} from 'react';
import {BookOpen,ChevronLeft,ChevronRight,ChevronsLeft,ChevronsUp,Copy,GripHorizontal,NotebookPen,Plus,Settings2,Trash2,X} from 'lucide-react';
import {useDayBridge} from '../../lib/storage/store';
import type {NoteColor} from '../../lib/types';
import {classifyBookletSwipe} from '../../lib/notes/page-gesture';

const palette:{id:NoteColor;label:string;background:string;edge:string}[]=[
 {id:'yellow',label:'Sunshine',background:'#fff2a8',edge:'#e4c866'},
 {id:'pink',label:'Rose',background:'#ffd9e3',edge:'#e6a9bc'},
 {id:'mint',label:'Mint',background:'#d3f9dc',edge:'#90d0a1'},
 {id:'blue',label:'Sky',background:'#d9edff',edge:'#a4c8e9'},
 {id:'lavender',label:'Lavender',background:'#e8ddff',edge:'#bcaae7'}
];
const styleFor=(color:NoteColor)=>palette.find(item=>item.id===color)||palette[0];

export function NotesView(){
 const {noteBooklets,addNoteBooklet,updateNoteBooklet,deleteNoteBooklet,addNotePage,updateNotePage,deleteNotePage}=useDayBridge();
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [pageIndex,setPageIndex]=useState(0);
 const [folding,setFolding]=useState(false);
 const [copyStatus,setCopyStatus]=useState('');
 const [editOpen,setEditOpen]=useState(false);
 const gesture=useRef<{pointerId:number;x:number;y:number}|null>(null);
 const [drag,setDrag]=useState({x:0,y:0});
 const flipTimeout=useRef<number|null>(null);
 const flipping=useRef(false);
 useEffect(()=>()=>{if(flipTimeout.current!==null)clearTimeout(flipTimeout.current);},[]);
 const book=noteBooklets.find(item=>item.id===selectedId);
 const currentIndex=book?Math.min(pageIndex,book.pages.length-1):0;
 const page=book?.pages[currentIndex];
 const swatch=styleFor(book?.color||'yellow');
 const stopAnimation=()=>{
   if(flipTimeout.current!==null)clearTimeout(flipTimeout.current);
   flipTimeout.current=null;
   flipping.current=false;
   gesture.current=null;
   setDrag({x:0,y:0});
   setFolding(false);
 };
 const open=(id:string)=>{stopAnimation();setEditOpen(false);setSelectedId(id);setPageIndex(0);setCopyStatus('');};
 const close=()=>{stopAnimation();setEditOpen(false);setSelectedId(null);};
 const create=()=>open(addNoteBooklet());
 const firstPage=()=>{
   if(currentIndex===0||flipping.current)return;
   setPageIndex(0);
   setCopyStatus('');
 };
 const flip=(direction:1|-1)=>{
   if(!book||flipping.current||(direction===-1&&currentIndex===0))return;
   flipping.current=true;
   const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   if(!reduceMotion)setFolding(true);
   const advance=()=>{
     if(direction===1&&currentIndex===book.pages.length-1)addNotePage(book.id);
     setPageIndex(current=>Math.max(0,current+direction));
     setCopyStatus('');
     setFolding(false);
     flipping.current=false;
     flipTimeout.current=null;
   };
   if(reduceMotion)advance();
   else flipTimeout.current=window.setTimeout(advance,230);
 };
 const pointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
   if(!event.isPrimary||flipping.current)return;
   gesture.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
   event.currentTarget.setPointerCapture(event.pointerId);
 };
 const pointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
   const start=gesture.current;
   if(!start||start.pointerId!==event.pointerId)return;
   const dx=event.clientX-start.x,dy=event.clientY-start.y;
   setDrag({x:Math.max(-48,Math.min(48,dx*.25)),y:Math.max(-30,Math.min(30,dy*.25))});
 };
 const pointerEnd=(event:React.PointerEvent<HTMLDivElement>,cancelled=false)=>{
   const start=gesture.current;
   if(!start||start.pointerId!==event.pointerId)return;
   gesture.current=null;
   setDrag({x:0,y:0});
   if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
   if(cancelled)return;
   const action=classifyBookletSwipe(event.clientX-start.x,event.clientY-start.y);
   if(action==='first')firstPage();
   else if(action==='next')flip(1);
   else if(action==='previous')flip(-1);
 };
 const copy=async()=>{
   if(!page)return;
   try{await navigator.clipboard.writeText(page.content);setCopyStatus('Copied to clipboard.');}
   catch{setCopyStatus('Clipboard unavailable. Select the text to copy it.');}
 };
 return <section className="relative flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden" aria-label="Sticky notes workspace">
  {!book ? <>
   <div className="flex shrink-0 items-center justify-between gap-2 py-1">
    <div className="min-w-0">
     <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><BookOpen className="h-5 w-5 shrink-0 text-teal-800"/>My sticky booklets</h2>
     <p className="text-[11px] text-slate-600">Encrypted device save · automatic sync</p>
    </div>
    <button type="button" onClick={create} className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-teal-800 px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Booklet</button>
   </div>
   {noteBooklets.length ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-2">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
     {noteBooklets.map(item=>{const color=styleFor(item.color);return <button key={item.id} type="button" onClick={()=>open(item.id)}
      className="relative flex min-h-[145px] flex-col rounded-xl p-3 text-left shadow-md transition-transform hover:-translate-y-1"
      style={{backgroundColor:color.background,borderBottom:'6px solid '+color.edge}}>
      <span aria-hidden="true" className="absolute right-0 top-0 h-7 w-7 bg-white/70" style={{clipPath:'polygon(0 0,100% 100%,100% 0)'}}/>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">{item.category||'Uncategorized'}</span>
      <strong className="mt-2 break-words text-base text-slate-950">{item.title||'Untitled booklet'}</strong>
      <span className="mt-auto pt-3 text-xs text-slate-600">{item.pages.length} {item.pages.length===1?'page':'pages'}</span>
     </button>})}
    </div>
   </div> : <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-5 text-center">
    <NotebookPen className="h-10 w-10 text-teal-700"/>
    <p className="mt-2 font-semibold text-slate-800">Your first sticky-note booklet starts here.</p>
    <button type="button" onClick={create} className="mt-4 min-h-11 rounded-xl bg-teal-800 px-5 font-semibold text-white">Create a booklet</button>
   </div>}
  </> : <>
   <div className="flex min-h-11 shrink-0 items-center justify-between gap-2">
    <button type="button" onClick={close} className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-1 text-xs font-semibold text-teal-900 sm:text-sm"><ChevronLeft className="h-4 w-4"/>Booklets</button>
    <span className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-slate-800 sm:text-sm">{book.title||'Untitled booklet'}</span>
    <button type="button" onClick={()=>setEditOpen(true)} className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 sm:text-sm" aria-label="Edit booklet title category and color">
     <Settings2 className="h-4 w-4"/>Edit
    </button>
   </div>
   <div className="relative mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-1 pb-1 pt-1">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-3 bottom-[-3px] rounded-2xl shadow-md" style={{backgroundColor:swatch.edge}}/>
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl px-3 pb-3 pt-3 shadow-xl sm:px-5"
      style={{backgroundColor:swatch.background,transformOrigin:'top center',
       transform:folding?'perspective(900px) rotateX(76deg) translateY(-35px)':'perspective(900px) rotateX(0deg)',
       opacity:folding?0.78:1,transition:'transform 230ms ease-in, opacity 230ms ease-in'}}>
     <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-9 w-9 bg-white/60 shadow-inner"
      style={{clipPath:'polygon(0 0,100% 100%,100% 0)'}}/>
     <div className="relative flex min-h-10 shrink-0 items-center justify-between gap-2 border-b border-black/10 pb-1">
      <strong className="min-w-0 truncate text-sm text-slate-950">{book.title||'Untitled booklet'}</strong>
      <div className="flex shrink-0 items-center gap-2">
       <span aria-live="polite" className="text-xs font-semibold text-slate-700">{currentIndex+1}/{book.pages.length}</span>
       <button type="button" onClick={firstPage} disabled={currentIndex===0||folding}
        className="flex min-h-9 items-center gap-1 rounded-lg border border-black/15 bg-white/65 px-2 text-[11px] font-semibold text-slate-800 disabled:opacity-40"
        aria-label="Go to first sticky note page"><ChevronsLeft className="h-4 w-4"/>First</button>
      </div>
     </div>
     <textarea aria-label="Write on this sticky page" placeholder="Write a thought, appointment detail, or reminder…" value={page?.content||''}
      onChange={e=>{if(page)updateNotePage(book.id,page.id,e.target.value);}} maxLength={30000}
      className="relative mt-2 block min-h-0 w-full flex-1 resize-none overflow-y-auto overscroll-contain bg-transparent p-1 text-base leading-8 text-slate-950 outline-none placeholder:text-slate-600/65"
      style={{backgroundImage:'repeating-linear-gradient(transparent, transparent 31px,rgba(0,0,0,.10) 32px)',backgroundAttachment:'local'}}/>
     <div role="group" aria-label="Sticky booklet swipe area"
      onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={event=>pointerEnd(event)} onPointerCancel={event=>pointerEnd(event,true)}
      onLostPointerCapture={()=>{gesture.current=null;setDrag({x:0,y:0});}}
      className="mt-2 flex min-h-[54px] shrink-0 cursor-grab flex-col items-center justify-center rounded-xl border border-black/15 bg-white/40 px-2 py-1 text-center select-none active:cursor-grabbing"
      style={{touchAction:'none',overscrollBehavior:'contain'}}>
      <div className="pointer-events-none flex flex-col items-center"
       style={{transform:'translate3d('+drag.x+'px,'+drag.y+'px,0)',transition:gesture.current?'none':'transform 160ms ease-out'}}>
       <span className="flex items-center gap-1 text-xs font-bold text-slate-900"><GripHorizontal className="h-4 w-4"/>Swipe here to turn</span>
       <span className="text-[10px] text-slate-700">↑ / ← Next · ↓ / → Back · long → First</span>
      </div>
     </div>
     <div className="mt-2 grid shrink-0 grid-cols-3 gap-2">
      <button type="button" disabled={currentIndex===0||folding} onClick={()=>flip(-1)}
       className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-black/15 bg-white/75 px-2 text-xs font-semibold text-slate-900 disabled:opacity-40"><ChevronLeft className="h-4 w-4"/>Back</button>
      <button type="button" onClick={()=>void copy()} className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-black/15 bg-white/75 px-2 text-xs font-semibold text-slate-900"><Copy className="h-4 w-4"/>Copy</button>
      <button type="button" disabled={folding} onClick={()=>flip(1)}
       className="flex min-h-10 items-center justify-center gap-1 rounded-xl bg-teal-800 px-2 text-xs font-semibold text-white disabled:opacity-50">{currentIndex===book.pages.length-1?'New page':'Next'}<ChevronRight className="h-4 w-4"/></button>
     </div>
    </div>
    {copyStatus&&<p role="status" className="absolute bottom-14 left-3 z-10 max-w-[90%] rounded-lg bg-white px-3 py-2 text-xs font-semibold text-teal-900 shadow-md">{copyStatus}</p>}
   </div>
   {editOpen&&<div className="absolute inset-0 z-20 flex min-h-0 flex-col rounded-2xl bg-slate-950/35 p-2 sm:p-4">
    <div role="dialog" aria-modal="true" aria-label="Edit sticky booklet" className="mx-auto flex min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
     <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-2">
      <h3 className="text-base font-bold text-slate-950">Booklet settings</h3>
      <button type="button" onClick={()=>setEditOpen(false)} aria-label="Close booklet settings" className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-800"><X className="h-5 w-5"/></button>
     </div>
     <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
      <label className="block text-xs font-semibold text-slate-700">Booklet title
       <input value={book.title} maxLength={100} onChange={e=>updateNoteBooklet(book.id,{title:e.target.value})}
        className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950" aria-label="Booklet title"/>
      </label>
      <label className="block text-xs font-semibold text-slate-700">Category
       <input value={book.category} maxLength={60} onChange={e=>updateNoteBooklet(book.id,{category:e.target.value})}
        className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950" aria-label="Booklet category"/>
      </label>
      <fieldset><legend className="mb-2 text-xs font-semibold text-slate-700">Booklet color</legend>
       <div className="flex flex-wrap gap-3">{palette.map(color=><button key={color.id} type="button" onClick={()=>updateNoteBooklet(book.id,{color:color.id})}
        aria-label={'Set '+color.label+' booklet color'} aria-pressed={book.color===color.id}
        title={color.label} className="h-11 w-11 rounded-full border-2 shadow-sm"
        style={{backgroundColor:color.background,borderColor:book.color===color.id?'#0f766e':color.edge,outline:book.color===color.id?'2px solid #0f766e':'none',outlineOffset:'2px'}}/>)}</div>
      </fieldset>
      {book.pages.length>1&&<button type="button" onClick={()=>{if(page&&window.confirm('Delete this sticky page? You can restore it using Undo.')){deleteNotePage(book.id,page.id);setPageIndex(i=>Math.max(0,i-1));}}}
       className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 px-3 text-sm font-semibold text-rose-800"><Trash2 className="h-4 w-4"/>Delete current page</button>}
      <button type="button" onClick={()=>{if(window.confirm('Delete this entire booklet and its pages? You can undo the change from Settings.')){deleteNoteBooklet(book.id);close();}}}
       className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 px-3 text-sm font-semibold text-rose-800"><Trash2 className="h-4 w-4"/>Delete booklet</button>
     </div>
     <button type="button" onClick={()=>setEditOpen(false)} className="m-3 min-h-11 shrink-0 rounded-xl bg-teal-800 px-4 font-semibold text-white">Done</button>
    </div>
   </div>}
  </>}
 </section>;
}

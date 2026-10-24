'use client';
import React,{useRef,useState} from 'react';
import {BookOpen,ChevronLeft,ChevronRight,Copy,NotebookPen,Plus,Trash2} from 'lucide-react';
import {useDayBridge} from '../../lib/storage/store';
import type {NoteColor} from '../../lib/types';

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
 const touch=useRef<{x:number;y:number}|null>(null);
 const book=noteBooklets.find(item=>item.id===selectedId);
 const currentIndex=book?Math.min(pageIndex,book.pages.length-1):0;
 const page=book?.pages[currentIndex];
 const swatch=styleFor(book?.color||'yellow');
 const open=(id:string)=>{setSelectedId(id);setPageIndex(0);setCopyStatus('');};
 const create=()=>open(addNoteBooklet());
 const flip=(direction:1|-1)=>{
   if(!book||folding||(direction===-1&&currentIndex===0))return;
   setFolding(true);
   window.setTimeout(()=>{
     if(direction===1&&currentIndex===book.pages.length-1)addNotePage(book.id);
     setPageIndex(current=>Math.max(0,current+direction));
     setFolding(false);
   },230);
 };
 const copy=async()=>{
   if(!page)return;
   try{await navigator.clipboard.writeText(page.content);setCopyStatus('Copied to clipboard.');}
   catch{setCopyStatus('Clipboard unavailable. Select the text to copy it.');}
 };
 return <section className="space-y-5 pb-20">
  {!book ? <>
   <div className="flex items-center justify-between gap-3">
    <div><h2 className="flex items-center gap-2 text-xl font-bold text-slate-950"><BookOpen className="h-6 w-6 text-teal-800"/>My sticky booklets</h2>
     <p className="mt-1 text-xs text-slate-600">Notes save privately on this device and sync automatically when connected.</p></div>
    <button type="button" onClick={create} className="flex min-h-11 items-center gap-1 rounded-xl bg-teal-800 px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Booklet</button>
   </div>
   {noteBooklets.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
    {noteBooklets.map(item=>{const color=styleFor(item.color);return <button key={item.id} type="button" onClick={()=>open(item.id)}
     className="relative flex min-h-[170px] flex-col rounded-xl p-4 text-left shadow-lg transition-transform hover:-translate-y-1"
     style={{backgroundColor:color.background,borderBottom:'7px solid '+color.edge}}>
     <span aria-hidden="true" className="absolute right-0 top-0 h-7 w-7 bg-white/70" style={{clipPath:'polygon(0 0,100% 100%,100% 0)'}}/>
     <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">{item.category||'Uncategorized'}</span>
     <strong className="mt-3 break-words text-lg text-slate-950">{item.title||'Untitled booklet'}</strong>
     <span className="mt-auto pt-4 text-xs text-slate-600">{item.pages.length} {item.pages.length===1?'page':'pages'}</span>
    </button>})}
   </div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
    <NotebookPen className="mx-auto h-10 w-10 text-teal-700"/>
    <p className="mt-2 font-semibold text-slate-800">Your first sticky-note booklet starts here.</p>
    <button type="button" onClick={create} className="mt-4 min-h-11 rounded-xl bg-teal-800 px-5 font-semibold text-white">Create a booklet</button>
   </div>}
  </> : <>
   <div className="flex items-center justify-between gap-2">
    <button type="button" onClick={()=>setSelectedId(null)} className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-teal-900"><ChevronLeft className="h-4 w-4"/>All booklets</button>
    <button type="button" onClick={()=>{if(window.confirm('Delete this entire booklet and its pages? You can undo the change from Settings.')){deleteNoteBooklet(book.id);setSelectedId(null);}}}
     aria-label="Delete booklet" className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-rose-800"><Trash2 className="h-4 w-4"/>Delete</button>
   </div>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-xs font-semibold text-slate-700">Booklet title
     <input value={book.title} maxLength={100} onChange={e=>updateNoteBooklet(book.id,{title:e.target.value})}
      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950" aria-label="Booklet title"/>
    </label>
    <label className="text-xs font-semibold text-slate-700">Category
     <input value={book.category} maxLength={60} onChange={e=>updateNoteBooklet(book.id,{category:e.target.value})}
      className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950" aria-label="Booklet category"/>
    </label>
   </div>
   <fieldset><legend className="mb-2 text-xs font-semibold text-slate-700">Booklet color</legend>
    <div className="flex flex-wrap gap-3">{palette.map(color=><button key={color.id} type="button" onClick={()=>updateNoteBooklet(book.id,{color:color.id})}
     aria-label={'Set '+color.label+' booklet color'} aria-pressed={book.color===color.id}
     title={color.label} className="h-11 w-11 rounded-full border-2 shadow-sm"
     style={{backgroundColor:color.background,borderColor:book.color===color.id?'#0f766e':color.edge,outline:book.color===color.id?'2px solid #0f766e':'none',outlineOffset:'2px'}} />)}</div>
   </fieldset>
   <div className="relative mx-auto w-full max-w-xl pt-3">
    <div aria-hidden="true" className="absolute inset-x-3 top-5 bottom-[-10px] rounded-2xl shadow-md" style={{backgroundColor:swatch.edge}}/>
    <div aria-hidden="true" className="absolute inset-x-1 top-3 bottom-[-4px] rounded-2xl shadow-sm" style={{backgroundColor:swatch.background}}/>
    <div className="relative min-h-[400px] overflow-hidden rounded-2xl px-5 pb-5 pt-6 shadow-xl sm:px-7"
     style={{backgroundColor:swatch.background,transformOrigin:'top center',
      transform:folding?'perspective(900px) rotateX(76deg) translateY(-50px)':'perspective(900px) rotateX(0deg)',
      opacity:folding?.78:1,transition:'transform 230ms ease-in, opacity 230ms ease-in'}}
     onTouchStart={e=>{const point=e.touches[0];touch.current={x:point.clientX,y:point.clientY};}}
     onTouchEnd={e=>{const start=touch.current;touch.current=null;const point=e.changedTouches[0];if(!start||!point)return;
       const dx=point.clientX-start.x,dy=point.clientY-start.y;
       if(Math.abs(dx)<85&&dy< -75)flip(1);else if(Math.abs(dx)<85&&dy>90)flip(-1);}}>
     <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-12 w-12 bg-white/60 shadow-inner"
       style={{clipPath:'polygon(0 0, 100% 100%, 100% 0)'}}/>
     <div className="relative flex items-center justify-between border-b border-black/10 pb-3">
      <strong className="max-w-[80%] truncate text-base text-slate-950">{book.title||'Untitled booklet'}</strong>
      <span className="text-xs font-semibold text-slate-700">{currentIndex+1}/{book.pages.length}</span>
     </div>
     <textarea aria-label="Write on this sticky page" placeholder="Write a thought, appointment detail, or reminder…" value={page?.content||''}
       onChange={e=>{if(page)updateNotePage(book.id,page.id,e.target.value);}} maxLength={30000}
       className="relative mt-3 min-h-[290px] w-full resize-y bg-transparent p-1 text-base leading-8 text-slate-950 outline-none placeholder:text-slate-600/65"
       style={{backgroundImage:'repeating-linear-gradient(transparent, transparent 31px,rgba(0,0,0,.10) 32px)',backgroundAttachment:'local'}}/>
     <p className="mt-2 text-center text-xs text-slate-600">Swipe up to fold this page and turn to the next</p>
    </div>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2 pt-5">
    <button type="button" disabled={currentIndex===0||folding} onClick={()=>flip(-1)}
      className="flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 disabled:opacity-40"><ChevronLeft className="h-4 w-4"/>Previous</button>
    <button type="button" onClick={()=>void copy()} className="flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900"><Copy className="h-4 w-4"/>Copy</button>
    <button type="button" disabled={folding} onClick={()=>flip(1)}
      className="flex min-h-11 items-center gap-1 rounded-xl bg-teal-800 px-4 text-sm font-semibold text-white disabled:opacity-50">{currentIndex===book.pages.length-1?'New page':'Fold page'}<ChevronRight className="h-4 w-4"/></button>
   </div>
   {book.pages.length>1&&<button type="button" onClick={()=>{if(page&&window.confirm('Delete this sticky page? You can restore it using Undo.')){deleteNotePage(book.id,page.id);setPageIndex(i=>Math.max(0,i-1));}}}
     className="flex min-h-11 items-center gap-2 text-sm text-rose-800"><Trash2 className="h-4 w-4"/>Delete this page</button>}
   {copyStatus&&<p role="status" className="text-xs text-teal-900">{copyStatus}</p>}
  </>}
 </section>;
}

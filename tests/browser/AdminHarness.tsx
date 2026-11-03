'use client';
import {useMemo} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AdminPortal} from '../../components/admin/AdminPortal';
export function AdminHarness(){
 const backend=useMemo(()=>({auth:{
  getUser:async()=>({data:{user:{id:'synthetic-admin'}},error:null}),
  onAuthStateChange:(callback:(event:string,session:unknown)=>void)=>{
   const listener=(event:Event)=>callback('SIGNED_OUT',(event as CustomEvent).detail);
   window.addEventListener('synthetic-admin-auth',listener);
   return {data:{subscription:{unsubscribe:()=>window.removeEventListener('synthetic-admin-auth',listener)}}};
  },
  signOut:async()=>{window.dispatchEvent(new CustomEvent('synthetic-admin-auth',{detail:null}));return {error:null};}
 }}) as unknown as SupabaseClient,[]);
 return <AdminPortal backend={backend}/>;
}

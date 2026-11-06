'use client';
import {useMemo} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {OwnerPortal} from '../../components/admin/OwnerPortal';
export function OwnerHarness(){
 const backend=useMemo(()=>({auth:{getUser:async()=>({data:{user:{id:'synthetic-owner'}},error:null}),onAuthStateChange:(fn:(event:string,session:unknown)=>void)=>{const listener=(event:Event)=>fn('SIGNED_OUT',(event as CustomEvent).detail);window.addEventListener('synthetic-owner-auth',listener);return {data:{subscription:{unsubscribe:()=>window.removeEventListener('synthetic-owner-auth',listener)}}};},signOut:async()=>{window.dispatchEvent(new CustomEvent('synthetic-owner-auth',{detail:null}));return {error:null};}}}) as unknown as SupabaseClient,[]);
 return <OwnerPortal backend={backend}/>;
}

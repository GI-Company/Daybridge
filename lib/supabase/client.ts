import { createBrowserClient } from '@supabase/ssr';
import type {SupabaseClient} from '@supabase/supabase-js';
let instance:SupabaseClient|null=null;
export function createClient():SupabaseClient|null {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return null;
 if(!instance)instance=createBrowserClient(url,key,{auth:{experimental:{passkey:true}}});
 return instance;
}
export function isSupabaseConfigured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));}

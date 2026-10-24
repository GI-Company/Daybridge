import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

export async function serverSupabase() {
 const store = await cookies();
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if (!url || !key) throw new Error('Supabase public config unavailable');
 return createServerClient(url, key, {
  cookieOptions:{path:'/',sameSite:'lax',secure:process.env.NODE_ENV==='production'},
  cookies: {
   getAll() { return store.getAll(); },
   setAll(items: {name:string;value:string;options?:CookieOptions}[]) { try { items.forEach(({ name, value, options }: {name:string;value:string;options?:CookieOptions}) => store.set(name, value, options)); } catch { /* read-only server component */ } },
  }
 });
}

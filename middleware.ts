import {NextResponse,type NextRequest} from 'next/server';
import {contentSecurityPolicy} from './lib/security/policy';
export function middleware(request:NextRequest){
 const nonce=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
 const policy=contentSecurityPolicy(nonce,process.env.NODE_ENV==='development',process.env.NEXT_PUBLIC_SUPABASE_URL);
 const headers=new Headers(request.headers);
 // Replace untrusted inbound values; Next applies this nonce to its framework and hydration scripts.
 headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',policy);
 const response=NextResponse.next({request:{headers}});
 response.headers.set('Content-Security-Policy',policy);
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
export const config={matcher:['/((?!api|_next|.*\\.[^/]+$).*)']};

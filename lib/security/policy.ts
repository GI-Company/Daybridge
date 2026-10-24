/** CSP for the installed private workspace. Inline styles are required by MapLibre and React positioning. */
export function contentSecurityPolicy(nonce:string,development:boolean,supabaseURL?:string):string {
 const connections=["'self'"];
 try{
  if(supabaseURL){const url=new URL(supabaseURL);if(url.protocol==='https:'||(development&&url.protocol==='http:')){connections.push(url.origin,url.origin.replace(/^http/,'ws'));}}
 }catch{/* Invalid configuration must not broaden the policy. */}
 if(development)connections.push('ws://localhost:*','ws://127.0.0.1:*');
 return [
  "default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,
  "style-src 'self' 'unsafe-inline'","img-src 'self' blob: data:","font-src 'self' data:",
  `connect-src ${connections.join(' ')}`,"worker-src 'self' blob:","manifest-src 'self'",
  "object-src 'none'","base-uri 'none'","form-action 'self'","frame-ancestors 'none'","frame-src 'none'",
  ...(development?[]:['upgrade-insecure-requests'])
 ].join('; ');
}

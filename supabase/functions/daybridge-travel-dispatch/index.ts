import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

Deno.serve(async (request: Request) => {
 if (request.method !== "POST") return new Response("Method not allowed", {status:405});
 const supplied=request.headers.get("x-daybridge-cron-secret")??"";
 if (supplied.length<32||supplied.length>256) return new Response("Unauthorized",{status:401});
 const url=Deno.env.get("SUPABASE_URL");
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key) return new Response("Worker misconfigured",{status:503});
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data, error}=await admin.rpc("daybridge_valid_cron_secret",{provided:supplied});
 if(error||data!==true)return new Response("Unauthorized",{status:401});
 const worker=Deno.env.get("DAYBRIDGE_WORKER_URL")??"https://daybridge-swart.vercel.app/api/cron/travel";
 if(!worker.startsWith("https://"))return new Response("Invalid worker URL",{status:503});
 try{
  const response=await fetch(worker,{
   method:"POST",headers:{"x-daybridge-cron-secret":supplied,"content-type":"application/json"},
   body:"{}",signal:AbortSignal.timeout(55000)
  });
  const result=await response.json().catch(()=>null);
  return new Response(JSON.stringify({delivered:response.ok,status:response.status,result}),{
   status:response.ok?200:502,headers:{"content-type":"application/json","cache-control":"no-store"}
  });
 }catch{
  return new Response(JSON.stringify({delivered:false,status:503}),{
   status:503,headers:{"content-type":"application/json","cache-control":"no-store"}
  });
 }
});

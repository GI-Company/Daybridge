import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime API; project type declarations target Node 20.
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier:string,context:unknown,next:(specifier:string,context:unknown)=>unknown){return specifier==='server-only'?{url:'data:text/javascript,export{}',shortCircuit:true}:next(specifier,context);}});
const {calculateRoute,tomTomKey}=await import('../lib/travel/tomtom.ts');
test('routing passes the early-arrival target and retains provider departure and arrival times',async()=>{
 const prior=globalThis.fetch,priorKey=process.env.TOMTOM_API_KEY;process.env.TOMTOM_API_KEY='synthetic-unit-key';
 const target=new Date(Date.now()+2*86400000).toISOString();let requested:URL|undefined;
 globalThis.fetch=async(input)=>{
  requested=new URL(String(input));
  return Response.json({routes:[{summary:{travelTimeInSeconds:1800,trafficDelayInSeconds:300,lengthInMeters:10000,departureTime:'2026-10-26T17:45:00-04:00',arrivalTime:'2026-10-26T18:15:00-04:00'},legs:[{points:[{latitude:34.6,longitude:-83.7},{latitude:34.7,longitude:-83.8}]}]}]});
 };
 try{
  const result=await calculateRoute({origin:{lat:34.6,lon:-83.7},destination:{lat:34.7,lon:-83.8},travelMode:'car',arriveAt:target});
  assert.equal(requested?.searchParams.get('arriveAt'),target);assert.equal(requested?.searchParams.has('departAt'),false);
  assert.equal(result.basis,'historical');assert.equal(result.routes[0].durationSeconds,1800);
  assert.equal(result.routes[0].departureTime,'2026-10-26T17:45:00-04:00');assert.equal(result.routes[0].arrivalTime,'2026-10-26T18:15:00-04:00');
 }finally{globalThis.fetch=prior;if(priorKey===undefined)delete process.env.TOMTOM_API_KEY;else process.env.TOMTOM_API_KEY=priorKey;}
});


test('foreground routing retries without live traffic on transient service failures',async()=>{
 const prior=globalThis.fetch,priorKey=process.env.TOMTOM_API_KEY;
 process.env.TOMTOM_API_KEY='synthetic-unit-key';
 const seen:URL[]=[];
 globalThis.fetch=async input=>{
  seen.push(new URL(String(input)));
  if(seen.length===1)return new Response(null,{status:503});
  return Response.json({routes:[{summary:{travelTimeInSeconds:900,trafficDelayInSeconds:0,lengthInMeters:2100},
   legs:[{points:[{latitude:34.61,longitude:-83.77},{latitude:34.62,longitude:-83.78}]}]}]});
 };
 try{
  const result=await calculateRoute({origin:{lat:34.61,lon:-83.77},destination:{lat:34.62,lon:-83.78},travelMode:'car'},
   {allowTrafficFallback:true});
  assert.equal(seen.length,2);
  assert.equal(seen[0].searchParams.get('traffic'),'true');
  assert.equal(seen[1].searchParams.get('traffic'),'false');
  assert.equal(seen[1].searchParams.get('computeTravelTimeFor'),'none');
  assert.equal(result.trafficAvailable,false);
  assert.equal(result.basis,'estimated');
  assert.equal(result.routes[0].durationSeconds,900);
 }finally{globalThis.fetch=prior;if(priorKey===undefined)delete process.env.TOMTOM_API_KEY;else process.env.TOMTOM_API_KEY=priorKey;}
});

test('bad TomTom routing credentials never trigger traffic-free fallback',async()=>{
 const prior=globalThis.fetch,priorKey=process.env.TOMTOM_API_KEY;
 process.env.TOMTOM_API_KEY='synthetic-unit-key';
 let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(null,{status:403})};
 try{
  await assert.rejects(
   calculateRoute({origin:{lat:34.6,lon:-83.76},destination:{lat:34.68,lon:-83.8},travelMode:'car'},
    {allowTrafficFallback:true}),error=>error instanceof Error && 'status' in error && error.status===403);
  assert.equal(calls,1);
 }finally{globalThis.fetch=prior;if(priorKey===undefined)delete process.env.TOMTOM_API_KEY;else process.env.TOMTOM_API_KEY=priorKey;}
});

test('new all_tom production key takes precedence without changing map-display credentials',()=>{
 const previous={all_tom:process.env.all_tom,tom_tom:process.env.tom_tom,TOMTOM_API_KEY:process.env.TOMTOM_API_KEY};
 try{
  process.env.all_tom='synthetic-full-access-key';
  process.env.tom_tom='synthetic-legacy-key';
  process.env.TOMTOM_API_KEY='synthetic-fallback-key';
  assert.equal(tomTomKey(),'synthetic-full-access-key');
  process.env.all_tom='  ';
  assert.equal(tomTomKey(),'synthetic-legacy-key');
 }finally{
  for(const [name,value] of Object.entries(previous)){
   if(value===undefined)delete process.env[name];
   else process.env[name]=value;
  }
 }
});

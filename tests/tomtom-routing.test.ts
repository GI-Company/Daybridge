import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime API; project type declarations target Node 20.
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier:string,context:unknown,next:(specifier:string,context:unknown)=>unknown){return specifier==='server-only'?{url:'data:text/javascript,export{}',shortCircuit:true}:next(specifier,context);}});
const {calculateRoute}=await import('../lib/travel/tomtom.ts');
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

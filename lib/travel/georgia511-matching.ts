import type {Point} from './types';

export type GeorgiaIncident={
 id:string;
 roadway:string;
 direction:string;
 description:string;
 type:string;
 fullClosure:boolean;
 point:Point;
};

export type GeorgiaEvent=GeorgiaIncident&{locations:Point[];updatedAt:number};

function validPoint(lat:unknown,lon:unknown):Point|null{
 if(typeof lat!=='number'||typeof lon!=='number'||!Number.isFinite(lat)||!Number.isFinite(lon)||
    Math.abs(lat)>90||Math.abs(lon)>180)return null;
 return {lat,lon};
}
function value(v:unknown,max:number):string{return typeof v==='string'?v.trim().slice(0,max):'';}

/** Normalize the documented 511GA /api/v2/get/event JSON response. */
export function parseGeorgiaEvents(data:unknown,nowMs=Date.now()):GeorgiaEvent[]{
 if(!Array.isArray(data))throw Error('Unexpected Georgia 511 response');
 const result:GeorgiaEvent[]=[];
 for(const raw of data.slice(0,15000)){
  if(!raw||typeof raw!=='object')continue;
  const e=raw as Record<string,unknown>;
  if(typeof e.ID!=='number'&&typeof e.ID!=='string')continue;
  const primary=validPoint(e.Latitude,e.Longitude);
  const secondary=validPoint(e.LatitudeSecondary,e.LongitudeSecondary);
  if(!primary&&!secondary)continue;
  const start=typeof e.StartDate==='number'?e.StartDate*1000:0;
  const end=typeof e.PlannedEndDate==='number'?e.PlannedEndDate*1000:0;
  if(start>nowMs+60000||(end>0&&end<nowMs))continue;
  const roadway=value(e.RoadwayName,80);
  const description=value(e.Description,320);
  const locations=[primary,secondary].filter((p):p is Point=>p!==null);
  result.push({
   id:String(e.ID).slice(0,40),roadway,direction:value(e.DirectionOfTravel,45),
   description:description||'Traffic event reported by Georgia 511',
   type:value(e.EventType,40),fullClosure:e.IsFullClosure===true,point:locations[0],
   locations,updatedAt:typeof e.LastUpdated==='number'?e.LastUpdated:0
  });
 }
 return result;
}

/** Point-to-road-polyline distance in meters (local equirectangular projection). */
export function distanceToRoute(point:Point,route:Point[]):number{
 if(route.length<2)return Infinity;
 const metersPerDegreeX=111320*Math.cos(point.lat*Math.PI/180);
 let best=Infinity;
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i];
  const ax=(a.lon-point.lon)*metersPerDegreeX,ay=(a.lat-point.lat)*111320;
  const bx=(b.lon-point.lon)*metersPerDegreeX,by=(b.lat-point.lat)*111320;
  const dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,(dx*dx+dy*dy)>0?-(ax*dx+ay*dy)/(dx*dx+dy*dy):0));
  best=Math.min(best,Math.hypot(ax+t*dx,ay+t*dy));
  if(best<1)return 0;
 }
 return best;
}

/** Proximity is deliberately not described as proof of same road or direction. */
export function eventsNearRoute(events:GeorgiaEvent[],route:Point[],maxMeters=750):GeorgiaIncident[]{
 if(route.length<2)return [];
 const bounds=route.reduce((v,p)=>({
  minLat:Math.min(v.minLat,p.lat),maxLat:Math.max(v.maxLat,p.lat),
  minLon:Math.min(v.minLon,p.lon),maxLon:Math.max(v.maxLon,p.lon)
 }),{minLat:Infinity,maxLat:-Infinity,minLon:Infinity,maxLon:-Infinity});
 const latMargin=maxMeters/111320;
 const lonMargin=maxMeters/(111320*Math.max(0.35,Math.cos((bounds.minLat+bounds.maxLat)*Math.PI/360)));
 return events.flatMap(e=>{
  let nearest=Infinity,location=e.point;
  for(const p of e.locations){
   if(p.lat<bounds.minLat-latMargin||p.lat>bounds.maxLat+latMargin||
      p.lon<bounds.minLon-lonMargin||p.lon>bounds.maxLon+lonMargin)continue;
   const distance=distanceToRoute(p,route);
   if(distance<nearest){nearest=distance;location=p;}
  }
  return nearest<=maxMeters?[{event:e,location,nearest}]:[];
 }).sort((a,b)=>Number(b.event.fullClosure)-Number(a.event.fullClosure)||a.nearest-b.nearest||
   b.event.updatedAt-a.event.updatedAt).slice(0,5).map(({event,location})=>({
    id:event.id,roadway:event.roadway,direction:event.direction,
    description:event.description,type:event.type,fullClosure:event.fullClosure,point:location
 }));
}

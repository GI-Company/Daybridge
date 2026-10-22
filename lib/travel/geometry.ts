import type {Point} from './types';

type IncomingPoint={
 latitude?:unknown;longitude?:unknown;lat?:unknown;lon?:unknown;
};

/** TomTom Routing v1 legs use latitude/longitude, unlike DayBridge lat/lon. */
export function normalizeTomTomRoutePoints(points:unknown):Point[]{
 if(!Array.isArray(points))return [];
 return points.flatMap((value):Point[]=>{
  if(!value||typeof value!=='object')return [];
  const p=value as IncomingPoint;
  const lat=p.latitude??p.lat;
  const lon=p.longitude??p.lon;
  if(typeof lat!=='number'||typeof lon!=='number'||
     !Number.isFinite(lat)||!Number.isFinite(lon)||
     Math.abs(lat)>85||Math.abs(lon)>180)return [];
  return [{lat,lon}];
 });
}

export function validMapPoint(value:unknown):value is Point{
 if(!value||typeof value!=='object')return false;
 const p=value as Partial<Point>;
 return typeof p.lat==='number'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=85&&
  typeof p.lon==='number'&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180;
}

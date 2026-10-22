import type {Point} from './types';
const extent=256,half=128,rad=Math.PI/180;
function xy(p:Point){
 const latitude=Math.max(-85,Math.min(85,p.lat))*rad;
 return {x:(p.lon+180)/360*extent,y:(1-Math.log(Math.tan(latitude)+1/Math.cos(latitude))/Math.PI)/2*extent};
}
function inv(p:{x:number;y:number}):Point{
 return {lon:p.x/extent*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*p.y/extent)))/rad};
}
export interface ProjectedRoute {center:Point;zoom:number;line:string;start:{x:number;y:number};finish:{x:number;y:number}};
/** Project a short non-dateline-crossing route into a 640x320 static TomTom map. */
export function projectRoute(points:Point[],origin:Point,destination:Point):ProjectedRoute{
 const all=points.length?[origin,...points,destination]:[origin,destination];
 const projected=all.map(xy);
 const xs=projected.map(p=>p.x),ys=projected.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const mid={x:(minX+maxX)/2,y:(minY+maxY)/2};
 const spreadX=Math.max(maxX-minX,0.00001),spreadY=Math.max(maxY-minY,0.00001);
 const zoom=Math.max(3,Math.min(17,Math.floor(Math.log2(Math.min(540/spreadX,220/spreadY)))));
 const project=(p:Point)=>{
  const c=xy(p);return{x:320+(c.x-mid.x)*2**zoom,y:160+(c.y-mid.y)*2**zoom};
 };
 const step=Math.max(1,Math.ceil(all.length/600));
 const line=all.filter((_,i)=>i%step===0||i===all.length-1).map(p=>{
  const point=project(p);return point.x.toFixed(1)+','+point.y.toFixed(1);
 }).join(' ');
 return {center:inv(mid),zoom,line,start:project(origin),finish:project(destination)};
}

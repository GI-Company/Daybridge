/**
 * Classifies deliberate page-turn gestures on the dedicated non-scrolling handle.
 * The note editor and the surrounding page retain normal native touch scrolling.
 */
export type BookletSwipe='next'|'previous'|'first'|null;
export function classifyBookletSwipe(dx:number,dy:number):BookletSwipe{
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return null;
 const horizontal=Math.abs(dx),vertical=Math.abs(dy);
 if(Math.max(horizontal,vertical)<60)return null;
 // Ignore diagonal movement to avoid surprise page changes.
 if(vertical>=horizontal*1.25)return dy<0?'next':'previous';
 if(horizontal>=vertical*1.25){
  // A deliberate long right swipe jumps straight back to page one.
  if(dx>=150)return 'first';
  return dx<0?'next':'previous';
 }
 return null;
}

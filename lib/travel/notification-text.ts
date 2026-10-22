export type DepartureAlertKind='preliminary'|'preparation'|'leave_now'|'traffic_change';
export type TravelNotificationInput={
 kind:DepartureAlertKind;
 nowMs:number;
 startMs:number;
 leaveByMs:number;
 travelSeconds:number;
 delaySeconds:number;
 priorTravelSeconds:number|null;
 timezone:string;
 arrivedLateMinutes:number;
 routeOptions:number;
 privacyMode:boolean;
 departed:boolean;
};

const minutes=(seconds:number)=>Math.max(0,Math.ceil(seconds/60));
const clock=(ms:number,timezone:string)=>new Date(ms).toLocaleTimeString('en-US',{
 timeZone:timezone,hour:'numeric',minute:'2-digit'
});

/** Never label estimates from an approved saved origin as live GPS. */
export function travelNotificationText(v:TravelNotificationInput):{title:string;body:string}{
 const trip=minutes(v.travelSeconds);
 const traffic=minutes(v.delaySeconds);
 const leave=clock(v.leaveByMs,v.timezone);
 const appt=clock(v.startMs,v.timezone);
 const arrival=clock(v.nowMs+v.travelSeconds*1000,v.timezone);
 const shift=v.priorTravelSeconds===null?null:Math.round((v.travelSeconds-v.priorTravelSeconds)/60);
 const difference=shift!==null&&Math.abs(shift)>=5
  ?' · '+(shift>0?'+':'')+shift+' min since last check':'';
 const base=trip+' min trip · traffic +'+traffic+' min'+difference;
 // Suppress appointment identity/destination in a private notification,
 // but preserve the travel information necessary for taking action.
 const source=v.departed?'Saved-route forecast':'From approved start';
 const route=v.routeOptions>1?' · '+v.routeOptions+' route options':'';
 if(v.departed){
  return {
   title: v.kind==='traffic_change'?'Traffic changed on your planned route':'Travel status update',
   body:base+'. Location not refreshed since you marked On my way; '+route.replace(/^ · /,'')+
    (route?' available.':'')+' Current-position ETA requires active guidance.'
  };
 }
 if(v.arrivedLateMinutes>0){
  return {
   title:'Possible late arrival · '+appt,
   body:base+' · estimated arrival '+arrival+' if leaving now ('+v.arrivedLateMinutes+
    ' min late)'+route+'.'
  };
 }
 if(v.kind==='leave_now'){
  return {
   title:'Leave now · appointment at '+appt,
   body:base+' · estimated arrival '+arrival+'. Tap On my way to acknowledge'+route+'.'
  };
 }
 if(v.kind==='preparation'){
  return {
   title:'Traffic update · leave by '+leave,
   body:base+' · planned departure '+leave+'. '+source+'; next checks may change this'+route+'.'
  };
 }
 if(v.kind==='traffic_change'){
  return {
   title:'Updated ETA · leave by '+leave,
   body:base+' · leave by '+leave+' to preserve your arrival buffer'+route+'.'
  };
 }
 return {
  title:'Travel preview · leave by '+leave,
  body:base+' · current leave-by estimate '+leave+' for '+appt+
   '. Rechecked nearer departure'+route+'.'
 };
}

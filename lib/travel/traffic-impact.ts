export type TravelImpact={
  travelSeconds:number;
  delaySeconds:number;
  priorTravelSeconds:number|null;
  priorDelaySeconds:number|null;
  nowMs:number;
  startMs:number;
  arrivalBufferMinutes:number;
  routeOptions:number;
};

export type TravelImpactResult={
  etaShiftSeconds:number|null;
  trafficShiftSeconds:number|null;
  leaveByMs:number;
  arrivalIfLeavingNowMs:number;
  lateForAppointmentMinutes:number;
  missedEarlyArrivalMinutes:number;
  meaningfulChange:boolean;
  gettingWorse:boolean;
  appointmentAtRisk:boolean;
  earlyArrivalAtRisk:boolean;
};

const valid=(n:number)=>Number.isFinite(n)&&n>=0;

export function assessTravelImpact(v:TravelImpact):TravelImpactResult{
 if(!valid(v.travelSeconds)||!valid(v.delaySeconds)||!Number.isFinite(v.startMs)||
    !Number.isFinite(v.nowMs))throw Error('Invalid traffic estimate');
 const bufferMs=Math.max(0,v.arrivalBufferMinutes)*60000;
 const arrivalIfLeavingNowMs=v.nowMs+v.travelSeconds*1000;
 const leaveByMs=v.startMs-v.travelSeconds*1000-bufferMs;
 const lateForAppointmentMinutes=Math.max(0,Math.ceil((arrivalIfLeavingNowMs-v.startMs)/60000));
 const missedEarlyArrivalMinutes=Math.max(0,Math.ceil((arrivalIfLeavingNowMs-(v.startMs-bufferMs))/60000));
 const etaShiftSeconds=v.priorTravelSeconds===null?null:v.travelSeconds-v.priorTravelSeconds;
 const trafficShiftSeconds=v.priorDelaySeconds===null?null:v.delaySeconds-v.priorDelaySeconds;
 const meaningfulChange=(etaShiftSeconds!==null&&Math.abs(etaShiftSeconds)>=300)||
                        (trafficShiftSeconds!==null&&Math.abs(trafficShiftSeconds)>=300);
 const gettingWorse=(etaShiftSeconds!==null&&etaShiftSeconds>=300)||
                    (trafficShiftSeconds!==null&&trafficShiftSeconds>=300);
 return {etaShiftSeconds,trafficShiftSeconds,leaveByMs,arrivalIfLeavingNowMs,
  lateForAppointmentMinutes,missedEarlyArrivalMinutes,meaningfulChange,gettingWorse,
  appointmentAtRisk:lateForAppointmentMinutes>0,earlyArrivalAtRisk:missedEarlyArrivalMinutes>0};
}

export function summarizeTrafficUpdate(
 impact:TravelImpactResult,travelSeconds:number,delaySeconds:number,
 routeCount:number,timezone:string
):string{
 const mins=Math.ceil(travelSeconds/60),delay=Math.ceil(delaySeconds/60);
 const time=(t:number)=>new Date(t).toLocaleTimeString('en-US',{timeZone:timezone,hour:'numeric',minute:'2-digit'});
 let summary='From your saved start: '+mins+' min travel, '+delay+' min traffic delay. ';
 if(impact.appointmentAtRisk){
  summary+='Leaving now could mean arriving '+impact.lateForAppointmentMinutes+' min late. ';
 }else if(impact.earlyArrivalAtRisk){
  summary+='Leaving now may miss your planned early-arrival buffer. ';
 }else {
  summary+='Leave by '+time(impact.leaveByMs)+'. ';
 }
 if(impact.meaningfulChange&&impact.etaShiftSeconds!==null){
  const minutes=Math.max(1,Math.round(Math.abs(impact.etaShiftSeconds)/60));
  summary+='ETA '+(impact.etaShiftSeconds>=0?'increased':'improved')+' about '+minutes+' min. ';
 }
 if(routeCount>1)summary+='Compare '+routeCount+' routes in DayBridge.';
 else if(impact.appointmentAtRisk)summary+='No faster alternative was returned.';
 return summary.trim();
}

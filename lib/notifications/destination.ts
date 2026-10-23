export const appTabs = ['today','schedule','locations','tasks','health','money','court','review','resources','settings'] as const;
export type AppTab = typeof appTabs[number];
export type NotificationDestination = {tab:AppTab;date?:string;event?:string;task?:string;medication?:string;bill?:string;slot?:string;account?:string};
const opaqueId = (value:string|null) => value && /^[\w-]{1,160}$/.test(value) ? value : undefined;
export function validDay(value:string|null):value is string {
 return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
export function parseNotificationDestination(raw:string,origin:string):NotificationDestination|null {
 try {
  const url=new URL(raw,origin);
  if(url.origin!==origin||url.pathname!=='/')return null;
  const tab=url.searchParams.get('tab');
  if(!appTabs.includes(tab as AppTab))return null;
  const target:NotificationDestination={tab:tab as AppTab};
  const day=url.searchParams.get('date');if(validDay(day))target.date=day;
  const account=opaqueId(url.searchParams.get('account'));if(account)target.account=account;
  for(const key of ['event','task','medication','bill'] as const){
   const value=opaqueId(url.searchParams.get(key));
   if(value&&((key==='event'&&(tab==='schedule'||tab==='locations'))||
    (key==='task'&&tab==='tasks')||(key==='medication'&&tab==='health')||(key==='bill'&&tab==='money')))target[key]=value;
  }
  const slot=url.searchParams.get('slot');
  if(tab==='health'&&slot&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(slot)&&Number.isFinite(Date.parse(slot)))target.slot=slot;
  return target;
 }catch{return null;}
}
export function notificationURL(target:NotificationDestination):string {
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(target))if(value)params.set(key,value);
 return '/?'+params.toString();
}

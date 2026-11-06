import type {OwnerCourt,OwnerDirectory} from './owner-types';
export type CourtReadiness={label:string;tone:'good'|'warning'|'neutral';detail:string};
export function courtReadiness(court:OwnerCourt,staffCount:number):CourtReadiness{
 if(!court.enabled)return {label:'Portal disabled',tone:'warning',detail:'Enable the court portal when staff should be able to sign in.'};
 if(!['pilot','active'].includes(court.subscription_status))return {label:'Enrollment paused',tone:'warning',detail:'Existing records remain. Change enrollment status to allow new participants.'};
 if(!staffCount)return {label:'Needs staff',tone:'warning',detail:'Assign a verified court staff sign-in before onboarding participants.'};
 if(!court.listed)return {label:'Not published',tone:'neutral',detail:'Staff are assigned. Publish when this court should appear in the sign-in directory.'};
 return {label:court.is_demo?'Test workspace':'Configured',tone:court.is_demo?'neutral':'good',detail:court.is_demo?'Use fictional participants here. This remains a labeled test court.':'Staff access and directory settings are configured. Complete device and participant acceptance before expanding.'};
}
export function ownerSummary(directory:OwnerDirectory){
 const activeStaff=directory.staff.filter(s=>s.active),staffByCourt=new Map<string,number>();
 for(const staff of activeStaff)staffByCourt.set(staff.court_id,(staffByCourt.get(staff.court_id)||0)+1);
 return {staffByCourt,activeStaff:activeStaff.length,
  occupied:directory.courts.reduce((n,c)=>n+c.occupied_seats,0),
  available:directory.courts.reduce((n,c)=>n+Math.max(0,c.seat_limit-c.occupied_seats),0),
  needsStaff:directory.courts.filter(c=>c.enabled&&!staffByCourt.get(c.id)).length,
  paused:directory.courts.filter(c=>!c.enabled||!['pilot','active'].includes(c.subscription_status)).length};
}

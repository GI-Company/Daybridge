export const reportingCategories=['meeting','class','check_in','obligation'] as const;
export type ReportingCategory=typeof reportingCategories[number];
export const categoryLabels:Record<ReportingCategory,string>={meeting:'Court-program meetings',class:'Court-program classes',check_in:'Court-program check-ins',obligation:'Shared court obligations'};
export type ProgressEvent={id:string;user_id?:string;username?:string;category:ReportingCategory;status:'complete'|'not_reported'|'incomplete'|'cancelled'|'withdrawn'|'unknown';scheduled_at:string|null;ends_at:string|null;reported_at:string|null;provenance:'participant_self_report'|'explicit_history';updated_at:string;first_shared_at?:string};
export type SharedItem={source_id:string;source_kind:'event'|'task';category:ReportingCategory;include_history:boolean;share_from:string;needs_review?:boolean};
export type ParticipantReporting={enabled:boolean;court_id:string;consents:{category:ReportingCategory;enabled:boolean;enabled_at:string}[];items:SharedItem[];events:ProgressEvent[];history:{category:ReportingCategory;enabled:boolean;reason:string;created_at:string}[]};
export type ProgressReport={enabled:boolean;events?:ProgressEvent[];participants?:{user_id:string;username:string;status:string;sharing_categories:number;last_reported_at:string|null}[];summary?:{shared:number;complete:number;incomplete:number;not_reported:number;upcoming:number};weekly?:{period:string;shared:number;complete:number}[];monthly?:{period:string;shared:number;complete:number}[];total_events?:number;events_truncated?:boolean;participants_truncated?:boolean;updated_at?:string};
export function progressLabel(event:ProgressEvent,now=Date.now()){
 if(event.status==='complete')return 'Self-reported complete';
 if(event.status==='incomplete')return 'Self-reported incomplete';
 if(event.status==='withdrawn')return 'Sharing withdrawn';
 if(event.status==='cancelled')return 'Self-reported cancelled';
 if(event.status==='unknown'||!event.scheduled_at)return 'Not enough information';
 if(new Date(event.scheduled_at).getTime()>now)return 'Upcoming';
 return 'Not self-reported';
}

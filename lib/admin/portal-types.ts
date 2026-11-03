export type ListedCourt={id:string;state_code:string;state_name:string;circuit_id:string;circuit_name:string;circuit_slug:string;court_name:string;court_slug:string};
export type CourtAccount={user_id:string;username:string;status:'active'|'suspended'|'removed';created_at:string;created_by_label:string};
export type PortalData={court:{id:string;name:string;is_demo:boolean;seat_limit:number;subscription_plan:string;subscription_status:string};occupied_seats:number;participants:CourtAccount[];administrator:{username:string;role:string}};
export type AuditEntry={id:string;action:string;username:string|null;actor_label:string;created_at:string};
export type AuditPage={entries:AuditEntry[];nextCursor:{time:string;id:string}|null};
export type PortalTab='overview'|'participants'|'create'|'resets'|'activity'|'settings';
export const auditActionLabels:Record<string,string>={participant_created:'Account created',participant_suspend:'Account suspended',participant_restore:'Account restored',participant_remove:'Removed from court',participant_password_reset:'Temporary password issued'};

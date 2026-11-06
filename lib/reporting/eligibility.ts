import type {CalendarEvent,TaskItem} from '../types';
import type {ReportingCategory} from './types';
export type EligibleItem={id:string;kind:'event'|'task';label:string;categories:ReportingCategory[]};
/** Private labels stay on device. Only opaque source identifiers are sent to the consent API. */
export function eligibleReportingItems(events:CalendarEvent[],tasks:TaskItem[]):EligibleItem[]{
 const court=events.filter(e=>e.category==='court'||e.category==='case_management');
 return [
  ...events.filter(e=>e.category==='class'||court.includes(e)).map(e=>({id:e.id,kind:'event' as const,label:e.title,categories:(e.category==='class'?['class']:['meeting','check_in','obligation']) as ReportingCategory[]})),
  ...tasks.filter(t=>court.some(e=>e.id===t.linkedEventId)).map(t=>({id:t.id,kind:'task' as const,label:t.title,categories:['obligation'] as ReportingCategory[]}))
 ];
}

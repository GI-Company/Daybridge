import {z} from 'zod';
export const categoryInput=z.enum(['meeting','class','check_in','obligation']);
export const participantReportingInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('consent'),category:categoryInput,enabled:z.boolean()}).strict(),
 z.object({action:z.literal('share'),source_kind:z.enum(['event','task']),source_id:z.string().min(1).max(120),category:categoryInput,include_history:z.boolean(),history_from:z.string().datetime({offset:true}).optional()}).strict().refine(v=>!v.include_history||!!v.history_from,'Choose an explicit history start'),
 z.object({action:z.literal('unshare'),source_kind:z.enum(['event','task']),source_id:z.string().min(1).max(120)}).strict()
]);
export const progressQuery=z.object({court_id:z.string().uuid(),start:z.string().datetime({offset:true}),end:z.string().datetime({offset:true}),participant:z.string().uuid().optional(),category:categoryInput.optional()}).strict().refine(v=>{const days=(Date.parse(v.end)-Date.parse(v.start))/86400000;return days>0&&days<=93;},'Choose a period of up to 93 days');

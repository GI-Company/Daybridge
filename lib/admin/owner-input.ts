import {z} from 'zod';
const name=z.string().trim().min(3).max(120);
const slug=z.string().regex(/^[a-z][a-z0-9-]{1,62}$/,'Use 2–63 lowercase letters, numbers or hyphens, starting with a letter');
const seats=z.number().int().min(1).max(100000);
export const ownerSetupInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),state_code:z.string().regex(/^[A-Z]{2}$/),state_name:z.string().trim().min(2).max(80),circuit_name:name,circuit_slug:slug,court_name:name,court_slug:slug,seat_limit:seats,is_demo:z.boolean(),listed:z.boolean()}).strict(),
 z.object({action:z.literal('update'),court_id:z.string().uuid(),court_name:name,seat_limit:seats,subscription_status:z.enum(['pilot','active','paused','canceled']),listed:z.boolean(),enabled:z.boolean()}).strict(),
 z.object({action:z.literal('assign_staff'),court_id:z.string().uuid(),username:z.string().regex(/^[a-z][a-z0-9_-]{2,31}$/),role:z.enum(['coordinator','case_manager'])}).strict(),
 z.object({action:z.literal('revoke_staff'),court_id:z.string().uuid(),user_id:z.string().uuid()}).strict()
]);

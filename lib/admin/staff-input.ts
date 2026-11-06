import {z} from 'zod';
const court_id=z.string().uuid();
export const staffCreateInput=z.object({court_id,username:z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_-]{2,31}$/),role:z.enum(['coordinator','case_manager'])}).strict();
export const staffResetInput=z.object({court_id,user_id:z.string().uuid()}).strict();
export const staffPasswordInput=z.object({court_id,current_password:z.string().min(1).max(256),password:z.string().min(12).max(256)}).strict()
 .refine(value=>value.password!==value.current_password,{message:'Choose a different password'});

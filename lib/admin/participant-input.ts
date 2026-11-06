import {z} from 'zod';

export function validBirthDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value
  &&value>='0001-01-01'&&value<=new Date().toISOString().slice(0,10);
}
export const participantCreateInput=z.object({
 court_id:z.string().uuid(),
 participant_name:z.string().trim().min(2).max(120)
  .regex(/^[^\u0000-\u001f\u007f]+$/,'Enter a name without control characters')
  .transform(value=>value.replace(/\s+/g,' ')),
 birth_date:z.string().refine(validBirthDate,'Enter a valid date of birth that is not in the future')
}).strict();

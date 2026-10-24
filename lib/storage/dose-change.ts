import type {DoseAction,Medication,MedicationLog} from '../types';

/** One explicit action per medication/slot. Undo removes an entry rather than recording a skipped dose. */
export function changeDose(medications:Medication[],logs:MedicationLog[],medicationId:string,slot:string,action:DoseAction|null,reason:string,userId:string){
 const medication=medications.find(item=>item.id===medicationId);
 if(!medication||!Number.isFinite(Date.parse(slot)))return null;
 const previous=logs.find(item=>item.medicationId===medicationId&&item.scheduledSlotUtc===slot);
 if((!action&&!previous)||(previous?.action===action&&(previous.skipReason||'')===reason))return null;
 const priorDelta=previous?.action==='taken'?(previous.inventoryDelta??-1):0;
 const baseline=typeof medication.inventoryCount==='number'?medication.inventoryCount-priorDelta:undefined;
 const delta=action==='taken'&&typeof baseline==='number'&&baseline>0?-1:0;
 const nextLogs=logs.filter(item=>!(item.medicationId===medicationId&&item.scheduledSlotUtc===slot));
 if(action)nextLogs.push({id:crypto.randomUUID(),userId,medicationId,scheduledSlotUtc:slot,action,recordedAtUtc:new Date().toISOString(),skipReason:reason,inventoryDelta:delta});
 return {logs:nextLogs,medications:medications.map(item=>item.id===medicationId&&typeof baseline==='number'?{...item,inventoryCount:baseline+delta}:item)};
}

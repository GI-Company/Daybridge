import type {AppointmentCategory,EventCategory,UserProfile} from './types';
export const defaultAppointmentCategories:AppointmentCategory[]=[
 {id:'court',label:'Court',color:'#d97706'}, {id:'class',label:'Class / group',color:'#9333ea'},
 {id:'self_help',label:'Self-help meeting',color:'#047857'}, {id:'drug_testing',label:'Drug test check-in',color:'#e11d48'},
 {id:'therapy',label:'Therapy',color:'#0284c7'}, {id:'work',label:'Work',color:'#4f46e5'},
 {id:'case_management',label:'Case management',color:'#b45309'}, {id:'personal',label:'Personal',color:'#0f766e'}, {id:'other',label:'Other',color:'#475569'}
];
export function appointmentCategories(profile:Pick<UserProfile,'appointmentCategories'>){
 const result=defaultAppointmentCategories.map(category=>({...category}));
 for(const value of (Array.isArray(profile.appointmentCategories)?profile.appointmentCategories:[]).slice(0,60)){
  if(!value||typeof value.id!=='string')continue;
  const index=result.findIndex(category=>category.id===value.id);
  if(index<0&&!/^custom_[a-z0-9-]{1,80}$/.test(value.id))continue;
  const original=index>=0?result[index]:{id:value.id,label:'Custom appointment',color:'#475569'};
  const item={...original,label:typeof value.label==='string'&&value.label.trim()?value.label.trim().slice(0,40):original.label,
   color:typeof value.color==='string'&&/^#[a-f\d]{6}$/i.test(value.color)?value.color:original.color,hidden:value.hidden===true};
  if(index>=0)result[index]=item;else result.push(item);
 }
 return result;
}
export function appointmentCategory(profile:Pick<UserProfile,'appointmentCategories'>,id:EventCategory){
 return appointmentCategories(profile).find(category=>category.id===id)||{id,label:'Custom appointment',color:'#475569'};
}

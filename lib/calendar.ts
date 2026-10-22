/** Calendar dates use the device's local calendar day rather than UTC. */
export function calendarDayKey(date:Date):string{
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function calendarStartOfDay(date:Date):Date{
 return new Date(date.getFullYear(),date.getMonth(),date.getDate());
}
export function calendarStartOfWeek(date:Date):Date{
 const start=calendarStartOfDay(date);
 start.setDate(start.getDate()-start.getDay());
 return start;
}
export function calendarWeekDays(date:Date):Date[]{
 const start=calendarStartOfWeek(date);
 return Array.from({length:7},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
}
export function calendarMonthDays(date:Date):Date[]{
 const first=new Date(date.getFullYear(),date.getMonth(),1);
 const start=calendarStartOfWeek(first);
 // Six rows keep a consistent month grid and include adjacent-month dates.
 return Array.from({length:42},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
}
export function calendarMove(date:Date,view:'week'|'month',amount:number):Date{
 if(view==='week')return new Date(date.getFullYear(),date.getMonth(),date.getDate()+amount*7);
 return new Date(date.getFullYear(),date.getMonth()+amount,1);
}
export function calendarRange(date:Date,view:'week'|'month'):{start:Date;end:Date;days:Date[]}{
 const days=view==='week'?calendarWeekDays(date):calendarMonthDays(date);
 const end=new Date(days[days.length-1].getFullYear(),days[days.length-1].getMonth(),days[days.length-1].getDate(),23,59,59,999);
 return {days,start:days[0],end};
}
export function calendarSameDay(a:Date,b:Date):boolean{
 return calendarDayKey(a)===calendarDayKey(b);
}

'use client';
import {useEffect} from 'react';
export function useRecordFocus(target:string|undefined,revision:number|undefined,contentKey:unknown){
 useEffect(()=>{
  if(!target)return;
  const element=document.querySelector<HTMLElement>('[data-notification-target="'+CSS.escape(target)+'"]');
  if(!element)return;
  for(let parent=element.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
  element.scrollIntoView({block:'center',behavior:'instant'});element.focus({preventScroll:true});
 },[target,revision,contentKey]);
}

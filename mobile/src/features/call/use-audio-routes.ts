import { useCallback, useEffect, useRef, useState } from 'react';
import { audioOutputs, selectOutput } from './audio-session';
import { preferredRoute } from './call-state';
export function useAudioRoutes(active:boolean) {
 const [outputs,setOutputs]=useState<string[]>([]);const [selected,setSelected]=useState('auto');
 const [error,setError]=useState('');const [changing,setChanging]=useState(false);
 const choice=useRef('auto');const available=useRef<string[]>([]);const generation=useRef(0);
 // Reset selections when the external native audio session changes.
 useEffect(()=>{
  // eslint-disable-next-line react-hooks/set-state-in-effect
  const epoch=++generation.current;let pending=false;choice.current='auto';setSelected('auto');setOutputs([]);available.current=[];setError('');
  if(!active)return;
  // LiveKit's public Android API has no selected-route/device-change subscription.
  // Poll availability only (1 Hz), while native AudioSwitch owns focus and device monitoring.
  const refresh=async()=>{if(pending)return;pending=true;try{
   const next=await audioOutputs();if(generation.current!==epoch)return;
   if(JSON.stringify(next)!==JSON.stringify(available.current)){
    available.current=next;setOutputs(next);
    if(choice.current!=='auto'&&!next.includes(choice.current)){choice.current='auto';setSelected('auto');}
    if(choice.current==='auto'){const best=preferredRoute(next);if(best)await selectOutput(best);}
   }
  }catch{if(generation.current===epoch)setError('Audio options are unavailable. Your call can continue.');}finally{pending=false;}};
  void refresh();const timer=setInterval(()=>void refresh(),1000);
  return()=>{if(generation.current===epoch)generation.current=epoch+1;clearInterval(timer);};
 },[active]);
 const choose=useCallback(async(id:string)=>{setChanging(true);setError('');try{
  const target=id==='auto'?preferredRoute(available.current):id;
  if(!target||!available.current.includes(target))throw new Error();
  await selectOutput(target);choice.current=id;setSelected(id);
 }catch{setError('That audio route is unavailable. Try another option.');}finally{setChanging(false);}},[]);
 return {outputs,selected,choose,changing,error};
}

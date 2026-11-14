import { useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
export function useLocalCamera(allowed:boolean){
 const [permission,request]=useCameraPermissions();const [enabled,setEnabled]=useState(false);
 const [pending,setPending]=useState(false);const [error,setError]=useState('');const epoch=useRef(0);
 // A stopped call must release camera hardware and invalidate pending permission requests.
 // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
 useEffect(()=>{if(!allowed){epoch.current++;setEnabled(false);}return()=>{epoch.current++;};},[allowed]);
 useEffect(()=>{const sub=AppState.addEventListener('change',value=>{if(value!=='active'){epoch.current++;setEnabled(false);}});return()=>sub.remove();},[]);
 const toggle=async()=>{if(pending)return;setError('');if(enabled){epoch.current++;setEnabled(false);return;}if(!allowed)return;
  const current=++epoch.current;setPending(true);try{const result=permission?.granted?permission:await request();
   if(current===epoch.current){setEnabled(result.granted);if(!result.granted)setError('Camera access is off. Your voice call can continue.');}
  }catch{setError('Preview unavailable. Your voice call can continue.');}finally{setPending(false);}
 };
 return {enabled:allowed&&enabled&&!!permission?.granted,pending,error,toggle};
}

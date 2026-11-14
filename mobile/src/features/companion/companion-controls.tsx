import {useEffect, useState} from 'react';
import {Text, TextInput, View} from 'react-native';
import {request} from '../../integration/api';
import type {DTO} from '../../integration/types';
import {Button, Surface, s} from '../product/product-ui';

type Context=DTO<'CompanionContext'>;
export function CompanionControls({sessionId,onChanged}:{sessionId:string|null;onChanged:()=>void}){
 const [context,setContext]=useState<Context|null>(null);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [values,setValues]=useState({mood:'',energy:'',sleep_hours:''});
 useEffect(()=>{let current=true;void request<Context>('/companion').then(v=>{if(current)setContext(v);}).catch(()=>{});return()=>{current=false;};},[]);
 if(!context)return null;
 const act=async(action:()=>Promise<Context>)=>{setBusy(true);setError('');try{const updated=await action();setContext(updated);setOpen(false);onChanged();}catch(e){const message=e instanceof Error?e.message:'';setError(message.includes('CHECKIN_DAY_CHANGED')?'The day changed. Review today’s date and try again.':message.includes('CHECKIN_ALREADY_RESOLVED')?'Today’s check-in was already saved or skipped.':message.includes('VERSION_CONFLICT')?'Your settings changed. Review the current settings and try again.':'Could not save right now. Your entries are still on this screen; please retry.');try{setContext(await request<Context>('/companion'));}catch{/* Keep the error visible; never silently retry a consent change. */}}finally{setBusy(false);}};
 const checkin=(decision:'confirm'|'decline')=>{
  const numeric={mood:Number(values.mood),energy:Number(values.energy),sleep_hours:Number(values.sleep_hours)};
  if(decision==='confirm'&&Object.entries(values).some(([k,v])=>!v.trim()||!Number.isFinite(numeric[k as keyof typeof numeric])||numeric[k as keyof typeof numeric]<0||numeric[k as keyof typeof numeric]>(k==='sleep_hours'?24:10))){setError('Enter mood and energy from 0 to 10, and sleep hours from 0 to 24.');return;}
  void act(()=>request('/companion/daily-checkin',{local_day:context.daily_checkin.local_day,expected_version:context.daily_checkin.version,decision,...(decision==='confirm'?{confirmation:true,values:numeric,session_id:sessionId}:{})}));
 };
 return <Surface><Text style={s.subtitle}>Your conversation</Text>
  <Text style={s.small}>Use my confirmed notes and check-in values in future conversations: {context.memory_enabled?'on':'off'}. Turning this on allows your confirmed notes and check-in values to be sent to AIriane’s conversation provider. Raw chats are not saved or replayed by this setting. Turning it off stops sending notes in new conversations; it cannot remove notes already shared with the provider. Existing notes remain in your Journey.</Text>
  <Button secondary label={context.memory_enabled?'Turn note context off':'Allow confirmed record context'} disabled={busy} onPress={()=>void act(()=>request('/companion',{memory_enabled:!context.memory_enabled,expected_version:context.version},'PATCH'))}/>
  <Text style={s.small}>Today’s optional check-in · {context.daily_checkin.local_day} · {context.daily_checkin.timezone}. These are your own wellbeing ratings, not a diagnostic test.</Text>
  {context.daily_checkin.state==='available'?<><Button label={open?'Hide check-in':'Open optional check-in'} secondary disabled={busy} onPress={()=>setOpen(v=>!v)}/>{open&&<View style={{gap:10}}>{(['mood','energy','sleep_hours'] as const).map(kind=><View key={kind}><Text style={s.small}>{kind==='sleep_hours'?'Sleep hours (0–24)':`${kind==='mood'?'Mood':'Energy'} (0–10)`}</Text><TextInput accessibilityLabel={kind==='sleep_hours'?'Sleep hours':kind} keyboardType="decimal-pad" value={values[kind]} onChangeText={value=>setValues(v=>({...v,[kind]:value}))} style={{borderWidth:1,borderColor:'#d7dedb',borderRadius:12,padding:12}}/></View>)}<Text style={s.small}>Review these values. Confirming saves them to your wellbeing records and makes them available to your reports.</Text><Button label="Confirm & save check-in" disabled={busy} onPress={()=>checkin('confirm')}/><Button secondary label="Not today" disabled={busy} onPress={()=>checkin('decline')}/></View>}</>:<Text style={s.small}>{context.daily_checkin.state==='completed'?'Today’s check-in is saved.':'Today’s check-in was skipped.'}</Text>}
  <Text style={s.small}>Validated screening questionnaires are separate and are not available here yet.</Text>
  {!!error&&<Text accessibilityRole="alert">{error}</Text>}
 </Surface>;
}

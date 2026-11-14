import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, TextInput, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Slot, usePathname, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Action, Card, styles as ui } from './src/components/ui';
import { Companion } from './src/features/call/companion';
import { CallScreen } from './src/features/call/call-screen';
import { nextCompanionState, type CompanionState } from './src/features/call/call-state';
import { requestVoicePermissions, releaseAudio } from './src/features/call/audio-session';
import { ElevenProvider, type ClientTools } from './src/integration/eleven-provider';
import { api, mode, request, setAccessToken, uuid } from './src/integration/api';
import { MobileUIBridge } from './src/integration/mobile-ui-bridge';
import type { VoiceAgentAdapter } from './src/integration/voice-agent-adapter';
import type { ActivitySession, Bootstrap, DTO, Journey, Recommendation, Session } from './src/integration/types';
import { theme } from './src/theme';
import { ReportsSharing } from './src/features/reports/reports-sharing';
type Screen='home'|'text'|'voice'|'breathing'|'journey'|'reports';
const realVoice=process.env.EXPO_PUBLIC_VOICE_PROVIDER==='elevenlabs';
export default function App(){
 const router=useRouter();const pathname=usePathname();const screen=(pathname==='/'?'home':pathname.slice(1)) as Screen;const setScreen=(value:Screen)=>router.push(value==='home'?'/':`/${value}` as '/');const [signedIn,setSignedIn]=useState(false);
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [session,setSession]=useState<Session|null>(null);
 const [rec,setRec]=useState<Recommendation|null>(null);const [activity,setActivity]=useState<ActivitySession|null>(null);
 const [journey,setJourney]=useState<Journey|null>(null);const [elapsed,setElapsed]=useState(0);const [rating,setRating]=useState(4);
 const [connected,setConnected]=useState(false);const [text,setText]=useState('');const [messages,setMessages]=useState<{role:string;text:string}[]>([]);
 const [callState,setCallState]=useState<CompanionState>('idle');const [voiceCall,setVoiceCall]=useState(false);const voiceCallRef=useRef(false);const levelRef=useRef(0);const [ending,setEnding]=useState(false);const [savedInCall,setSavedInCall]=useState(false);const connectEpoch=useRef(0);const adapterSubscription=useRef<(()=>void)|null>(null);
 const [muted,setMuted]=useState(false);const adapter=useRef<VoiceAgentAdapter|null>(null);const bridge=useRef<MobileUIBridge|null>(null);
 const connection=useRef<DTO<'ProviderConnection'>|null>(null);const renderAck=useRef<(()=>void)|null>(null);
 const activeGate=useRef<Promise<void>>(Promise.resolve());
 const activityRef=useRef<ActivitySession|null>(null);
 useEffect(()=>{activityRef.current=activity;},[activity]);
 const completeKey=useRef(uuid());const feedbackKey=useRef(uuid());
 useEffect(()=>{renderAck.current?.();renderAck.current=null;},[rec]);
 useEffect(()=>{if(screen!=='breathing'||activity?.state!=='started')return;const timer=setInterval(()=>setElapsed(e=>e+1),1000);return()=>clearInterval(timer);},[screen,activity?.state]);
 const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}};
 const makeBridge=(s:Session)=>{const dispatch=async(name:string,args:Record<string,unknown>)=>{await activeGate.current;const c=connection.current;if(!c||c.state!=='active')throw new Error('Voice connection is not active');const id=uuid();return request<DTO<'ToolResult'>>(`/conversation-sessions/${s.session_id}/tools/${name}`,{connection_id:c.connection_id,tool_call_id:id,contract_version:'2.0.0',arguments:args},'POST',id);};
 const bridgeApi={recommendations:async(id:string,limit:number)=>realVoice?(await dispatch('present_activity_recommendations',{limit})).result as Recommendation:api.recommendations(id,limit),start:async(id:string,r:Recommendation,a:string,channel:'voice'|'touch')=>{const option=r.options.find(o=>o.activity.activity_id===a)!;return realVoice&&channel==='voice'?(await dispatch('select_activity',{recommendation_id:r.recommendation_id,activity_id:a,activity_version:option.activity.activity_version})).result as ActivitySession:api.start(id,r,a,channel);}};
 const value=new MobileUIBridge(bridgeApi,s.session_id,r=>new Promise<void>(resolve=>{renderAck.current=resolve;setRec(r);}),a=>{if(activityRef.current?.activity_session_id!==a.activity_session_id){setElapsed(0);completeKey.current=uuid();feedbackKey.current=uuid();}activityRef.current=a;setActivity(a);setSavedInCall(false);setScreen('breathing');});bridge.current=value;return value;};
 const ensureSession=async(kind:'voice'|'text')=>{if(session){if(!bridge.current)makeBridge(session);return session;}const created=await api.session(kind);setSession(created);makeBridge(created);return created;};
 const login=async(demo=false)=>{
  if(mode==='mock'){setAccessToken('mock-only');setSignedIn(true);return;}
  if(demo){setAccessToken('demo-patient-token');}
  else{
   const url=process.env.EXPO_PUBLIC_SUPABASE_URL;const key=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
   if(!url||!key)throw new Error('Set Supabase public URL/key, or explicitly enable development demo auth.');
   const result=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
   const payload=await result.json();if(!result.ok)throw new Error(payload.msg??'Sign in failed');setAccessToken(payload.access_token);
  }
  await request('/me/onboarding',{display_name:demo?'Fictional patient':email.split('@')[0],timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});setSignedIn(true);setPassword('');
  const savedJourney=await api.journey();setJourney(savedJourney);const running=savedJourney.items.find(item=>item.activity_session.state==='started');
  if(running){setActivity(running.activity_session);activityRef.current=running.activity_session;setElapsed(0);const parent=await request<Session>(`/conversation-sessions/${running.activity_session.session_id}`);if(parent.state!=='ended')setSession(parent);}
 };
 const closeConnection=useCallback(async()=>{
  const current=connection.current;connection.current=null;setConnected(false);
  if(current&&mode==='live')await request(`/conversation-sessions/${current.session_id}/agent-connections/${current.connection_id}`,{state:'closed',expected_version:current.version},'PATCH');
 },[]);
 const receiveAdapter=useCallback((value:VoiceAgentAdapter)=>{adapter.current=value;adapterSubscription.current?.();adapterSubscription.current=value.subscribe(event=>{if(event.type==='audio_level'){levelRef.current=event.level??0;return;}setCallState(current=>nextCompanionState(current,event));if(event.type==='disconnected'||event.type==='error'){levelRef.current=0;setConnected(false);}});},[]);
 useEffect(()=>()=>{adapterSubscription.current?.();void adapter.current?.disconnect();void releaseAudio().catch(()=>{});},[]);
 const openConversation=async(kind:'voice'|'text')=>{
  const epoch=++connectEpoch.current;voiceCallRef.current=kind==='voice';setVoiceCall(kind==='voice');setScreen(kind);setCallState('connecting');setSavedInCall(false);setError('');
  await adapter.current?.disconnect();await closeConnection();setMuted(false);
  if(kind==='voice')await requestVoicePermissions();
  if(epoch!==connectEpoch.current)return;
  const s=await ensureSession(kind);
  if(epoch!==connectEpoch.current)return;
  if(!realVoice){setConnected(true);setCallState('listening');setMessages(m=>[...m,{role:'agent',text:'Simulated agent: ask for help relaxing, or display activity recommendations.'}]);return;}
  if(mode!=='live')throw new Error('ElevenLabs requires live FastAPI bootstrap; mock backend cannot issue credentials.');
  // Refresh because session version changes when provider connections are provisioned.
  const fresh=await request<Session>(`/conversation-sessions/${s.session_id}`);
  const b=await request<Bootstrap>(`/conversation-sessions/${s.session_id}/agent-connections`,{mode:kind,expected_version:fresh.version});
  if(epoch!==connectEpoch.current){await request(`/conversation-sessions/${s.session_id}/agent-connections/${b.connection_id}`,{state:'closed',expected_version:1},'PATCH');return;}
  const active=await request<DTO<'ProviderConnection'>>(`/conversation-sessions/${s.session_id}/agent-connections/${b.connection_id}`,{state:'connecting',expected_version:1},'PATCH');connection.current=active;
  let resolveActive:()=>void=()=>{};activeGate.current=new Promise(resolve=>{resolveActive=resolve;});
  try{await adapter.current!.connect(b);if(epoch!==connectEpoch.current){resolveActive();await adapter.current?.disconnect();await closeConnection();return;}connection.current=await request(`/conversation-sessions/${s.session_id}/agent-connections/${b.connection_id}`,{state:'active',expected_version:active.version},'PATCH');resolveActive();setConnected(true);}catch(e){resolveActive();await closeConnection();await releaseAudio().catch(()=>{});setCallState('disconnected');throw e;}
 };
 const tools=useMemo<ClientTools>(()=>({present_activity_recommendations:async args=>{setCallState('thinking');if(!bridge.current)throw new Error('Open an application session first');return JSON.stringify(await bridge.current.present(Number(args.limit)));},select_activity:async args=>{if(!bridge.current?.recommendation)throw new Error('No current recommendations');const current=bridge.current.recommendation;const chosen=current.options.find(o=>o.activity.activity_id===args.activity_id);if(current.recommendation_id!==args.recommendation_id||chosen?.activity.activity_version!==args.activity_version)throw new Error('Stale recommendation/version');return JSON.stringify(await bridge.current.select(String(args.activity_id),'voice'));}}),[]);
 const complete=async()=>{
  if(!activity||(mode==='mock'&&!rec))return;
  const saved=activity.state==='completed'?activity:await api.complete(activity,elapsed,completeKey.current);setActivity(saved);
  await api.feedback(saved,rec,rating,feedbackKey.current);setJourney(await api.journey());setSavedInCall(true);setScreen(voiceCallRef.current?'voice':'journey');try{adapter.current?.updateContext(JSON.stringify({activity_session_id:saved.activity_session_id,state:'completed',rating}));}catch{setConnected(false);}
 };
 const sendText=async()=>{const value=text.trim();if(!value)return;if(!connected)await openConversation('text');setMessages(m=>[...m,{role:'user',text:value}]);setText('');if(realVoice)adapter.current!.sendText(value);else{await bridge.current!.present();setMessages(m=>[...m,{role:'agent',text:'Simulated response: Calm Breathing is available in the card below.'}]);}};
 const cards=rec&&<View style={{gap:12}}><Text style={ui.eyebrow}>CHOSEN FOR THIS MOMENT</Text>{rec.options.map(option=><Card key={option.activity.activity_id}><Text style={ui.heading}>{option.activity.title}</Text><Text style={ui.body}>{option.reason}</Text><Text style={ui.body}>{option.activity.duration_seconds/60} minute · optional</Text><Action disabled={busy} label="Begin Calm Breathing" onPress={()=>void run(async()=>{await bridge.current!.select(option.activity.activity_id,'touch');})}/></Card>)}</View>;
 const endCall=async()=>{if(ending)return;connectEpoch.current++;setEnding(true);setCallState('disconnected');voiceCallRef.current=false;try{await adapter.current?.disconnect();}catch{/* Always release hardware, even if signaling failed. */}finally{await releaseAudio().catch(()=>{});await closeConnection().catch(()=>{});setVoiceCall(false);setEnding(false);setScreen('home');}};
 const leaveCallActivity=async()=>{if(activity?.state==='started'&&mode==='live')setActivity(await request<ActivitySession>(`/activity-sessions/${activity.activity_session_id}/events`,{client_event_id:uuid(),expected_version:activity.version,event_type:'abandon',elapsed_seconds:elapsed,event_at:new Date().toISOString()}));setScreen('voice');};
 const immersive=signedIn&&(screen==='voice'||(screen==='breathing'&&voiceCall));
 const body=<SafeAreaProvider>{immersive?<CallScreen state={error&&callState==='connecting'?'disconnected':callState} levelRef={levelRef} connected={connected} muted={muted} busy={busy} ending={ending} error={error} caption={messages.filter(m=>m.role!=='user').at(-1)?.text??''} recommendation={rec} activity={activity} inActivity={screen==='breathing'} elapsed={elapsed} rating={rating} saved={savedInCall} onMute={()=>{adapter.current?.setMicrophoneMuted(!muted);setMuted(!muted);}} onPause={()=>{if(connected){adapter.current?.setMicrophoneMuted(true);setMuted(true);setCallState(current=>current==='disconnected'?current:'interrupted');}}} onEnd={()=>void endCall()} onRetry={()=>void run(()=>openConversation('voice'))} onSelect={id=>void run(async()=>{await bridge.current!.select(id,'touch');})} onRating={setRating} onComplete={()=>void run(complete)} onLeaveActivity={()=>void run(leaveCallActivity)}/>:<><StatusBar style="dark"/><ScrollView style={styles.root} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"><View style={styles.top}><Text style={ui.eyebrow}>RE / A LITTLE SPACE FOR YOU</Text></View>
 {!signedIn?<><Text style={ui.heading}>Welcome back.</Text><Text style={ui.body}>A quiet place to check in, talk, and take one small step.</Text><Card><TextInput accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} style={styles.input}/><TextInput accessibilityLabel="Password" secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} style={styles.input}/><Action label={mode==='mock'?'Enter fictional demo':'Sign in'} disabled={busy} onPress={()=>void run(()=>login())}/>{mode==='live'&&process.env.EXPO_PUBLIC_DEMO_AUTH==='true'&&<Action secondary label="Development demo sign in" disabled={busy} onPress={()=>void run(()=>login(true))}/>}</Card></>:<>
 <View style={styles.nav}>{(['home','text','voice','journey','reports'] as Screen[]).map(item=><Action key={item} secondary label={item==='journey'?'My Journey':item[0].toUpperCase()+item.slice(1)} disabled={busy} onPress={()=>void run(async()=>{if(item==='voice'||item==='text')await openConversation(item);else{setScreen(item);if(item==='journey')setJourney(await api.journey());}})}/>)}</View>
 {screen==='home'&&<>{activity?.state==='started'&&<Action label="Resume Calm Breathing" disabled={busy} onPress={()=>setScreen('breathing')}/>}<Text style={ui.heading}>How are you arriving today?</Text><Text style={ui.body}>There is no right answer. Start wherever feels comfortable.</Text><View style={{alignItems:'center'}}><Companion state="idle" levelRef={levelRef} size={190}/></View><Action label="Talk with RE" disabled={busy} onPress={()=>void run(()=>openConversation('voice'))}/><Action label="I'd rather type" secondary disabled={busy} onPress={()=>void run(()=>openConversation('text'))}/></>}
 {screen==='text'&&<><Text style={ui.heading}>What’s on your mind?</Text><Text style={ui.body}>{connected?'Here with you':'Start a conversation when you’re ready'}</Text>
 {screen==='text'&&<><Text style={ui.body}>Text mode uses the same application conversation context. No microphone is started.</Text>{messages.map((m,i)=><Card key={i}><Text style={ui.eyebrow}>{m.role==='user'?'YOU':'RE'}</Text><Text style={ui.body}>{m.text}</Text></Card>)}<TextInput accessibilityLabel="Message" multiline placeholder="I could use help relaxing…" value={text} onChangeText={setText} style={styles.input}/><Action label="Send message" disabled={busy||!text.trim()} onPress={()=>void run(sendText)}/></>}
 {!realVoice&&<Action label="Simulate: I’d like help relaxing" disabled={busy||!connected} onPress={()=>void run(async()=>{await ensureSession(screen);await tools.present_activity_recommendations({limit:3});})}/>}{cards}<Action secondary label="End conversation" disabled={busy||!connected} onPress={()=>void run(async()=>{await adapter.current?.disconnect();await closeConnection();setConnected(false);})}/></>}
 {screen==='breathing'&&activity&&<><Text style={ui.eyebrow}>ONE COMFORTABLE MINUTE</Text><Text style={ui.heading}>Calm Breathing</Text><Text style={ui.body}>Breathe comfortably. Stop whenever you need.</Text><View style={[styles.orb,{transform:[{scale:elapsed%8<4?1:0.85}]}]}><Text style={ui.heading}>{elapsed%8<4?'Breathe in':'Breathe out'}</Text></View><Text style={ui.body}>{Math.min(elapsed,60)} / 60 seconds</Text><Text style={ui.body}>How helpful was this?</Text><View style={styles.nav}>{[1,2,3,4,5].map(n=><Action key={n} secondary={rating!==n} disabled={busy||activity.state==='completed'} label={String(n)} onPress={()=>setRating(n)}/>)}</View><Action label={busy?'Saving…':activity.state==='completed'?'Retry saving feedback':'Complete & save'} disabled={busy||elapsed<60} onPress={()=>void run(complete)}/><Action label="Leave activity" secondary disabled={busy} onPress={()=>void run(async()=>{if(mode==='live'&&activity.state==='started')setActivity(await request<ActivitySession>(`/activity-sessions/${activity.activity_session_id}/events`,{client_event_id:uuid(),expected_version:activity.version,event_type:'abandon',elapsed_seconds:elapsed,event_at:new Date().toISOString()}));setScreen('home');})}/></>}
 {screen==='reports'&&<ReportsSharing/>}
 {screen==='journey'&&<><Text style={ui.heading}>My Journey</Text><Text style={ui.body}>Small steps, at your pace. Only accepted saved results appear here.</Text>{journey===null?<Text>Loading your journey…</Text>:journey.items.length===0?<Card><Text style={ui.body}>No saved activities yet. Try a comfortable breathing pause.</Text></Card>:journey.items.map(item=><Card key={item.activity_session.activity_session_id}><Text style={ui.heading}>{item.activity.title}</Text><Text style={ui.body}>{item.activity_session.state} · {item.feedback?`helpfulness ${item.feedback.rating}/5`:'feedback pending'}</Text><Text style={ui.body}>{new Date(item.activity_session.started_at).toLocaleString()}</Text></Card>)}<Action secondary label="Refresh saved results" disabled={busy} onPress={()=>void run(async()=>setJourney(await api.journey()))}/></>}
 </>}{busy&&<Text accessibilityRole="progressbar">One moment…</Text>}{error!==''&&<Card><Text accessibilityRole="alert" style={{color:theme.error}}>{error}</Text><Text style={ui.body}>Your work is retained. Retry when ready.</Text></Card>}<Text style={styles.footer}>Wellbeing support · You can pause at any time.</Text></ScrollView></>}</SafeAreaProvider>;
 return <><Slot/>{realVoice?<ElevenProvider tools={tools} onAdapter={receiveAdapter} onMessage={(role,value)=>setMessages(m=>[...m,{role,text:value}])} onDisconnected={()=>{void closeConnection().catch(()=>setError('Connection closed; retry lifecycle update.'));}}>{body}</ElevenProvider>:body}</>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:theme.background},content:{padding:24,paddingTop:64,paddingBottom:48,gap:20,maxWidth:700,width:'100%',alignSelf:'center'},top:{gap:8,marginBottom:12},mode:{fontSize:11,color:theme.muted},nav:{flexDirection:'row',flexWrap:'wrap',gap:8},input:{backgroundColor:theme.low,borderRadius:16,padding:16,fontSize:16,minHeight:54,color:theme.ink},orb:{width:220,height:220,borderRadius:110,backgroundColor:theme.mint,alignSelf:'center',justifyContent:'center',alignItems:'center',marginVertical:16},footer:{fontSize:12,textAlign:'center',color:theme.muted,marginTop:24}});

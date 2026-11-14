import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { request, uuid } from '../../integration/api';
import type { DTO } from '../../integration/types';
import { Button, s, Surface } from '../product/product-ui';
import { theme as t } from '../../theme';
import { MutationAttempt, themeLabel } from './model';

export function SavedInsights({insights,onChanged}:{insights:DTO<'ConfirmedInsight'>[];onChanged:()=>void|Promise<void>}) {
  const current=insights.filter(i=>i.state==='confirmed');
  return <View style={styles.list}>{current.length===0?<Surface><Text style={s.sectionTitle}>Your insights will appear here</Text><Text style={s.subtitle}>You choose which conversation summaries to keep. Nothing is saved until you confirm it.</Text></Surface>:current.map(row=><InsightEntry key={`${row.insight_id}:${row.version}`} row={row} onChanged={onChanged}/>)}</View>;
}
function InsightEntry({row,onChanged}:{row:DTO<'ConfirmedInsight'>;onChanged:()=>void|Promise<void>}) {
  const [action,setAction]=useState<'view'|'edit'|'delete'>('view');const [text,setText]=useState(row.text);const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [evidence,setEvidence]=useState(false);
  const attempt=useRef(new MutationAttempt());const flight=useRef(false);const [removed,setRemoved]=useState(false);
  async function mutate(){if(flight.current)return;flight.current=true;setBusy(true);setError('');try{const body=action==='edit'?{session_id:row.session_id,theme:row.theme,text:text.trim(),observed_at:row.observed_at,statement_kind:row.statement_kind,confirmation:true,expected_version:row.version,reason:reason.trim()}:undefined;const key=attempt.current.prepare({action,body,id:row.insight_id},uuid);await request(`/confirmed-insights/${row.insight_id}${action==='edit'?'/corrections':''}`,body,action==='edit'?'POST':'DELETE',key);setRemoved(true);try{await onChanged();}catch{setError('Saved. Refresh your Journey to see the latest records.');}}catch(e){setError(e instanceof Error?e.message:'Could not save. Please retry.');}finally{flight.current=false;setBusy(false);}}
  if(removed)return error?<Text accessibilityRole="alert" style={s.small}>{error}</Text>:null;
  return <Surface><Text style={s.eyebrow}>{themeLabel(row.theme)}</Text><Text style={s.sectionTitle}>{row.text}</Text><Text style={s.small}>{new Date(row.observed_at).toLocaleString()} · Patient confirmed</Text><Text style={s.small}>{row.statement_kind==='direct_statement'?'Direct self-report':'Patient-approved AI interpretation'}</Text>
    {action==='edit'&&<><TextInput accessibilityLabel="Correct saved insight" value={text} onChangeText={setText} multiline maxLength={500} editable={!busy} style={styles.input}/><TextInput accessibilityLabel="Reason for correction" placeholder="What needs correcting?" value={reason} onChangeText={setReason} maxLength={500} editable={!busy} style={styles.input}/><Text style={s.small}>The corrected summary becomes current. Approved earlier versions remain in correction history until you delete the insight.</Text><Button label={busy?'Saving correction…':'Confirm correction'} onPress={()=>void mutate()} disabled={busy||!text.trim()||!reason.trim()}/></>}
    {action==='delete'&&<><Text style={s.subtitle}>Delete this insight and its correction history? Its text will also be removed from stored reports. This cannot be undone.</Text><Button label={busy?'Deleting…':'Yes, delete insight'} onPress={()=>void mutate()} disabled={busy}/></>}
    {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {action==='view'?<><View style={styles.actions}><Button label="Edit" secondary onPress={()=>setAction('edit')}/><Button label="Delete" secondary onPress={()=>setAction('delete')}/><Button label={evidence?'Hide evidence':'Evidence'} secondary onPress={()=>setEvidence(v=>!v)}/></View>{evidence&&<View style={styles.list}><Text style={s.small}>Confirmed {new Date(row.confirmed_at).toLocaleString()} · Version {row.version}</Text><Text selectable style={s.small}>Source: patient-approved structured summary. No transcript is required.</Text>{row.sources.map(source=><Text selectable key={source.source_id} style={s.small}>Reference {source.source_id} · revision {source.source_revision}</Text>)}{row.supersedes_insight_id&&<Text selectable style={s.small}>Corrects {row.supersedes_insight_id}</Text>}</View>}</>:<Button label="Cancel" secondary onPress={()=>{setAction('view');setError('');}} disabled={busy}/>} 
  </Surface>;
}
const styles=StyleSheet.create({list:{gap:12},actions:{flexDirection:'row',gap:8,flexWrap:'wrap'},input:{borderWidth:1,borderColor:t.border,padding:14,borderRadius:16,minHeight:68,textAlignVertical:'top',color:t.ink,fontFamily:t.type.body,fontSize:14,backgroundColor:t.low},error:{color:t.error,fontSize:13,lineHeight:20}});

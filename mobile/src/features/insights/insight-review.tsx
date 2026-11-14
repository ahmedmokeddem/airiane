import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { request, uuid } from '../../integration/api';
import type { DTO } from '../../integration/types';
import { Button, s } from '../product/product-ui';
import { theme as t } from '../../theme';
import { approvedInsightBody, MutationAttempt, themeLabel, type InsightProposal } from './model';

export function InsightReview({proposal,onDismiss,onSaved,dark=false}:{proposal:InsightProposal;onDismiss:()=>void;onSaved:(insight:DTO<'ConfirmedInsight'>)=>void;dark?:boolean}) {
  const [text,setText]=useState(proposal.text);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const attempt=useRef(new MutationAttempt());const inFlight=useRef(false);
  async function confirm(){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');try{const body=approvedInsightBody(proposal,text);const saved=await request<DTO<'ConfirmedInsight'>>('/confirmed-insights',body,'POST',attempt.current.prepare(body,uuid));onSaved(saved);}catch(e){setError(e instanceof Error?e.message:'Could not save. Please retry.');}finally{inFlight.current=false;setBusy(false);}}
  return <View style={[styles.card,dark&&styles.dark]} accessibilityLabel="Review proposed insight">
    <Text style={[s.eyebrow,dark&&styles.light]}>Your words, your choice</Text>
    <Text style={[s.sectionTitle,dark&&styles.light]}>Keep this in your Journey?</Text>
    <Text style={[s.small,dark&&styles.light]}>Suggested {themeLabel(proposal.theme)} · {proposal.statement_kind==='direct_statement'?'Based on what you said':'AI interpretation — please check carefully'}</Text>
    <TextInput testID="insight-draft" accessibilityLabel="Edit insight before confirming" value={text} onChangeText={setText} editable={!busy} multiline maxLength={500} style={[styles.input,dark&&styles.darkInput]} placeholderTextColor={dark?t.mist:t.muted}/>
    <Text style={[s.small,dark&&styles.light]}>Only the summary you confirm is saved. Rejected suggestions are discarded. Shared reports may include saved insights according to your sharing choices.</Text>
    {!!error&&<Text accessibilityRole="alert" style={[styles.error,dark&&styles.light]}>{error}</Text>}
    <View style={styles.actions}><View style={styles.grow}><Button label={busy?'Saving insight…':'Confirm & save'} onPress={()=>void confirm()} disabled={busy||!text.trim()}/></View><Button label="Reject" secondary onPress={onDismiss} disabled={busy}/></View>
  </View>;
}
const styles=StyleSheet.create({card:{padding:18,borderRadius:24,borderWidth:1,borderColor:t.border,backgroundColor:t.surface,gap:12},dark:{backgroundColor:t.navy,borderColor:'#537180'},light:{color:t.mist},input:{minHeight:96,textAlignVertical:'top',borderWidth:1,borderColor:t.border,borderRadius:16,padding:14,color:t.ink,fontFamily:t.type.body,fontSize:15,lineHeight:22,backgroundColor:t.low},darkInput:{color:t.mist,backgroundColor:t.brandNavy,borderColor:'#537180'},actions:{flexDirection:'row',gap:10,alignItems:'center'},grow:{flex:1},error:{color:t.error,fontSize:13,lineHeight:20}});

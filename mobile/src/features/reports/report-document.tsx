import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import type { DTO } from '../../integration/types';
import { theme as t } from '../../theme';
import { Surface, s } from '../product/product-ui';

export function ReportDocument({report}:{report:DTO<'Report'>}) {
 const doc=report.document!;
 const [evidenceOpen,setEvidenceOpen]=useState(false);
 const refs=new Map(doc.snapshot.evidence.map((e,i)=>[e.id,`E${String(i+1).padStart(3,'0')}`]));
 return <View style={p.root} testID="patient-report-document">
  <View style={p.cover}><Text style={p.eyebrow}>A THREAD THROUGH YOUR JOURNEY</Text><Text style={p.title}>The moments you chose to keep.</Text><Text style={p.coverText}>{new Date(report.period_start).toLocaleDateString()} – {new Date(report.period_end).toLocaleDateString()} · {report.timezone}</Text><Text style={p.coverText}>A private reflection of saved experiences. Missing days remain unknown.</Text></View>
  {doc.sections.map((section,index)=><Surface key={section.id}><Text style={s.eyebrow}>{String(index+1).padStart(2,'0')} · YOUR SAVED STORY</Text><Text style={s.sectionTitle}>{section.patient_title}</Text>{doc.claims.filter(c=>c.section===section.id).map(c=><View key={c.id} style={p.claim}><Text selectable style={s.subtitle}>{c.patient_text}</Text>{c.evidence_ids.length>0&&<Text style={s.small}>Evidence {c.evidence_ids.map(id=>refs.get(id)).join(', ')}</Text>}</View>)}</Surface>)}
  {doc.charts.map(chart=>{const max=Math.max(1,...chart.points.map(p=>p.value));return <Surface key={chart.id}><Text style={s.sectionTitle}>{chart.title}</Text><Text style={s.small}>{chart.caption} · {chart.unit}</Text>{chart.points.map((point,i)=><View key={i} style={p.chartRow}><Text style={s.small}>{point.label} · {point.value}</Text><View style={[p.bar,{width:`${Math.max(1,point.value/max*100)}%`}]}/><Text style={s.small}>{point.evidence_ids.map(id=>refs.get(id)).join(', ')}</Text></View>)}</Surface>;})}
  <Surface><Pressable accessibilityRole="button" accessibilityState={{expanded:evidenceOpen}} onPress={()=>setEvidenceOpen(v=>!v)} style={p.control}><Text style={s.sectionTitle}>{evidenceOpen?'Hide':'View'} evidence references</Text></Pressable>{evidenceOpen&&doc.snapshot.evidence.map(e=><View key={e.id} style={p.claim}><Text style={s.eyebrow}>{refs.get(e.id)} · {e.phase.toUpperCase()} PERIOD</Text><Text style={s.sectionTitle}>{e.label}</Text><Text style={s.small}>{new Date(e.date).toLocaleString(undefined,{timeZone:report.timezone})} · {e.origin.replaceAll('_',' ')}</Text>{e.text&&<Text selectable style={s.subtitle}>“{e.text}”</Text>}{e.value!==null&&<Text style={s.subtitle}>{e.value} {e.unit}</Text>}<Text selectable style={s.small}>Record {e.record_id}{'\n'}Sources {e.source_ids.join(', ')}</Text></View>)}<Text style={s.small}>Prepared {new Date(report.generated_at).toLocaleString()} · Version {report.version}. Downloaded copies cannot be remotely revoked.</Text></Surface>
 </View>;
}
const p=StyleSheet.create({root:{gap:18},cover:{padding:25,borderRadius:28,backgroundColor:t.navy,gap:18},eyebrow:{fontFamily:t.type.body,fontSize:10,letterSpacing:1.8,color:t.mint},title:{fontFamily:t.type.display,fontSize:31,lineHeight:40,color:'#fff'},coverText:{fontFamily:t.type.body,fontSize:13,lineHeight:22,color:'#d5e3df'},claim:{gap:8,paddingVertical:12,borderTopWidth:1,borderTopColor:t.border},control:{minHeight:48,justifyContent:'center'},chartRow:{gap:6,paddingVertical:8},bar:{height:8,borderRadius:5,backgroundColor:t.accent}});

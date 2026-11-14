import { useMemo, useState } from 'react';
import { ExportController } from './export-controller';
import { Platform, Text } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { reportPdfBytes, uuid } from '../../integration/api';
import { Button, Surface, s } from '../product/product-ui';

const retention=15*60*1000;
async function localPdf(bytes:Uint8Array){
 const directory=new Directory(Paths.cache,'report-exports');
 await directory.create({idempotent:true});
 for(const item of directory.list())if(item instanceof File && Date.now()-(item.modificationTime??0)>retention)await item.delete();
 const file=new File(directory,`AIriane-${uuid()}.pdf`);
 await file.write(bytes);
 // Keep enough time for system viewers/share targets to finish reading. Next export also sweeps.
 setTimeout(()=>{try{file.delete();}catch{/* Already removed by cache cleanup. */}},retention);
 return file.uri;
}
export function PdfExport({reportId,enabled}:{reportId:string;enabled:boolean}){
 const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);const [error,setError]=useState('');
 const controller=useMemo(()=>new ExportController({
  download:async()=>{
   const bytes=await reportPdfBytes(reportId);
   if(Platform.OS==='web'){
    const blob=new Blob([bytes.slice().buffer],{type:'application/pdf'});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='AIriane-report.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    return 'browser-download';
   }
   return localPdf(bytes);
  },
  save:async uri=>{await Print.printAsync({uri});},
  share:async uri=>{if(!await Sharing.isAvailableAsync())throw new Error('File sharing is not available on this device.');await Sharing.shareAsync(uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Share your AIriane report'});},
 }),[reportId]);
 const run=async(action:'download'|'save'|'share')=>{if(busy)return;setBusy(true);setError('');try{await controller.execute(action);}catch(e){setError(e instanceof Error?e.message:'Export could not be completed.');}finally{setReady(controller.ready);setBusy(false);}};
 return <Surface><Text style={s.sectionTitle}>Keep a copy of your story</Text><Text style={s.subtitle}>Export a private PDF. Nothing is sent to another person unless you choose Share. Downloaded copies cannot be remotely revoked.</Text><Button label={busy?'Preparing your PDF…':'Export PDF'} icon="download" disabled={busy||!enabled} onPress={()=>void run('download')}/>{!enabled&&<Text style={s.small}>Generate a fresh report to export this updated format.</Text>}{ready&&<><Text accessibilityRole="alert" style={s.small}>{Platform.OS==='web'?'Download requested in your browser.':'PDF ready in private temporary storage. Use Save / print to keep a copy.'}</Text>{Platform.OS!=='web'&&<><Button label="Save / print PDF" icon="file-text" disabled={busy} onPress={()=>void run('save')}/><Button label="Share PDF…" icon="share-2" secondary disabled={busy} onPress={()=>void run('share')}/></>}</>}{error&&<Text accessibilityRole="alert" style={s.subtitle}>{error}</Text>}</Surface>;
}

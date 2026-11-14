'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function PdfDownload({patientId,reportId,enabled}:{patientId:string;reportId:string;enabled:boolean}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const router=useRouter();
 async function download(){if(busy)return;setBusy(true);setError('');try{
  const response=await fetch(`/reports/${encodeURIComponent(patientId)}/${encodeURIComponent(reportId)}/pdf`,{cache:'no-store',signal:AbortSignal.timeout(65000)});
  if(!response.ok){if([401,403,404].includes(response.status))router.refresh();const body=await response.json();throw new Error(body.message??'Export unavailable.');}
  const blob=await response.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='AIriane-report.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){setError(e instanceof Error?e.message:'Export failed. Please retry.');}finally{setBusy(false);}}
 return <div className="pdf-actions" aria-busy={busy}><button type="button" disabled={busy||!enabled} onClick={()=>void download()}>{busy?'Preparing PDF…':'Export PDF'}</button>{!enabled&&<p>The patient must regenerate this snapshot before export.</p>}<p>Confidential. Revocation prevents future application access; previously downloaded copies cannot be remotely revoked.</p>{error&&<p role="alert">{error}</p>}</div>;
}

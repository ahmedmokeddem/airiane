import { cookies } from 'next/headers';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{patientId:string;reportId:string}>}){
 const token=(await cookies()).get('re_access_token')?.value;
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 if(!token||process.env.PORTAL_DATA_MODE!=='api')return Response.json({message:'Sign in to download an authorized report.'},{status:401,headers});
 const {patientId,reportId}=await params;
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 if(!uuid.test(patientId)||!uuid.test(reportId))return new Response(null,{status:404,headers});
 try{
  const response=await fetch(new URL(`/v1/doctor/patients/${patientId}/reports/${reportId}/pdf`,process.env.RE_API_URL??'http://127.0.0.1:8000'),{headers:{Authorization:`Bearer ${token}`,Accept:'application/pdf'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!response.ok)return Response.json({message:response.status===403?'Patient authorization is unavailable or has been revoked.':response.status===409?'This snapshot needs regeneration by the patient.':'The report could not be downloaded.'},{status:response.status,headers});
  if(!response.headers.get('content-type')?.startsWith('application/pdf'))throw new Error('Invalid document');
  return new Response(await response.arrayBuffer(),{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="AIriane-report-${reportId}.pdf"`}});
 }catch{return Response.json({message:'Export is temporarily unavailable. Please retry.'},{status:503,headers});}
}

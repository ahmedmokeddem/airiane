import type { DTO } from '../../integration/types';
export const insightThemes = ['fatigue','sleep','positive_experience','concern','clinician_question','reflection','goal'] as const;
export type ParsedInsightProposal = Pick<DTO<'ConfirmedInsightCreate'>,'theme'|'text'|'observed_at'|'statement_kind'>;
export type InsightProposal = ParsedInsightProposal & {proposal_id:string;session_id:string|null};
export function parseInsightProposal(args:unknown):ParsedInsightProposal {
  if(!args || typeof args!=='object' || Array.isArray(args))throw new Error('The proposed insight is invalid.');
  const r=args as Record<string,unknown>;
  if(Object.keys(r).some(k=>!['theme','text','observed_at','statement_kind'].includes(k)) || Object.keys(r).length!==4)throw new Error('The proposed insight has unsupported fields.');
  if(!insightThemes.includes(r.theme as typeof insightThemes[number]) || typeof r.text!=='string' || !r.text.trim() || r.text.length>500 || typeof r.observed_at!=='string' || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(r.observed_at) || !Number.isFinite(Date.parse(r.observed_at)) || !['direct_statement','patient_approved_interpretation'].includes(String(r.statement_kind)))throw new Error('The proposed insight is incomplete or invalid.');
  return {theme:r.theme,text:r.text.trim(),observed_at:r.observed_at,statement_kind:r.statement_kind} as ParsedInsightProposal;
}
export function approvedInsightBody(proposal:InsightProposal,text:string):DTO<'ConfirmedInsightCreate'> {
  const parsed=parseInsightProposal({theme:proposal.theme,text,observed_at:proposal.observed_at,statement_kind:proposal.statement_kind});
  return {...parsed,session_id:proposal.session_id,confirmation:true};
}
/** Hold one key for an unchanged patient-approved body, including a retry after a timeout. */
export class MutationAttempt {
  private fingerprint='';private key='';
  prepare(body:unknown,allocate:()=>string):string {const fingerprint=JSON.stringify(body);if(fingerprint!==this.fingerprint){this.fingerprint=fingerprint;this.key=allocate();}return this.key;}
}
export const themeLabel=(value:string)=>value.replace(/_/g,' ');

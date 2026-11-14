"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../brand';
import { emptyReportFilters, kindLabels, reportDate, selectReports, statusLabels, type ReportFilters, type ReportSort, type SharedReportRow } from '@/lib/shared-reports';

const pageSize = 15;
const columns: {key:ReportSort; label:string}[] = [
  {key:'patientName',label:'Patient'}, {key:'kind',label:'Document'}, {key:'periodStart',label:'Reporting period'}, {key:'createdAt',label:'Created'}, {key:'status',label:'Status'},
];
export function SharedReportsTable({ rows, patients, nextCursor }: {
  rows: SharedReportRow[];
  patients: {id:string;name:string}[];
  nextCursor: string | null;
}) {
  const [filters,setFilters] = useState<ReportFilters>(emptyReportFilters);
  const [sort,setSort] = useState<ReportSort>('createdAt');
  const [direction,setDirection] = useState<'asc'|'desc'>('desc');
  const [page,setPage] = useState(0);
  const update = (key:keyof ReportFilters,value:string) => {setFilters(old=>({...old,[key]:value}));setPage(0);};
  const shown = selectReports(rows,filters,sort,direction);
  const pageCount = Math.max(1,Math.ceil(shown.length/pageSize));
  const currentPage = Math.min(page,pageCount-1);
  const visible = shown.slice(currentPage*pageSize,(currentPage+1)*pageSize);
  const invalidDates = !!filters.from && !!filters.to && filters.from>filters.to;
  const active = Object.values(filters).some(Boolean);
  return <section className="shared-report-surface" aria-label="Shared reports">
    <div className="shared-report-toolbar">
      <label className="shared-report-search"><span>Find a report</span><div><Icon name="document"/><input type="search" value={filters.search} onChange={e=>update('search',e.target.value)} placeholder="Patient name or report ID"/></div></label>
      <label><span>Patient</span><select value={filters.patient} onChange={e=>update('patient',e.target.value)}><option value="">All loaded patients</option>{[...patients].sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label><span>Document</span><select value={filters.kind} onChange={e=>update('kind',e.target.value)}><option value="">All types</option><option value="wellbeing">Wellbeing reports</option><option value="insight">Conversation insights</option></select></label>
      <label><span>Status</span><select value={filters.status} onChange={e=>update('status',e.target.value)}><option value="">All statuses</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <div className="shared-report-dates">
      <label><span>Period from</span><input type="date" value={filters.from} onChange={e=>update('from',e.target.value)} aria-invalid={invalidDates} /></label>
      <label><span>Period to</span><input type="date" value={filters.to} onChange={e=>update('to',e.target.value)} aria-invalid={invalidDates}/></label>
      {active && <button type="button" className="report-clear" onClick={()=>{setFilters(emptyReportFilters);setPage(0);}}>Clear filters</button>}
      <p>Dates use UTC. Period filters include overlapping reporting periods.</p>
    </div>
    {invalidDates && <p className="report-filter-error" role="alert">Choose an end date on or after the start date.</p>}
    <div className="shared-report-count"><p aria-live="polite">{shown.length} of {rows.length} loaded reports{active ? ' match your filters' : ''}</p><span>{patients.length} loaded {patients.length===1?'patient':'patients'}</span></div>
    {visible.length ? <>
      <div className="shared-report-scroll" role="region" aria-label="Reports table; scroll horizontally on smaller screens" tabIndex={0}>
        <table className="shared-report-table">
          <caption className="sr-only">Authorized wellbeing reports and shared conversation insights. Select a column heading to sort.</caption>
          <thead><tr>{columns.map(column=><th key={column.key} scope="col" aria-sort={sort===column.key ? direction==='asc'?'ascending':'descending':'none'}><button type="button" onClick={()=>{if(sort===column.key)setDirection(old=>old==='asc'?'desc':'asc');else{setSort(column.key);setDirection(column.key==='createdAt'||column.key==='periodStart'?'desc':'asc');}setPage(0);}}>{column.label}<span aria-hidden="true">{sort===column.key ? direction==='asc'?'↑':'↓':'↕'}</span></button></th>)}<th scope="col"><span className="sr-only">Open document</span></th></tr></thead>
          <tbody>{visible.map(row=><tr key={`${row.patientId}:${row.kind}:${row.id}`}>
            <td><Link className="report-patient" href={`/patients/${row.patientId}`}><span className="directory-avatar" aria-hidden="true">{row.patientName[0]}</span><strong>{row.patientName}</strong></Link></td>
            <td><strong className="report-kind">{kindLabels[row.kind]}</strong><small>{row.version!==null?`Snapshot v${row.version} · `:''}Ref {row.id.slice(0,8)}</small></td>
            <td>{row.periodStart&&row.periodEnd?<><time dateTime={row.periodStart}>{reportDate(row.periodStart)}</time><span className="report-period-end">to <time dateTime={row.periodEnd}>{reportDate(row.periodEnd)}</time></span></>:'Period unavailable'}</td>
            <td>{row.createdAt?<time dateTime={row.createdAt}>{reportDate(row.createdAt)}</time>:'Date unavailable'}{row.sharedAt&&<small>Shared {reportDate(row.sharedAt)}</small>}</td>
            <td><span className={`report-state report-state-${row.status}`}>{statusLabels[row.status]}</span></td>
            <td>{['ready','stale','shared'].includes(row.status)?<Link className="report-open" href={row.href} aria-label={`Open ${kindLabels[row.kind].toLowerCase()} for ${row.patientName}, ${reportDate(row.createdAt)}`}>Open <Icon name="arrow"/></Link>:<span className="report-wait">Not ready</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {pageCount>1&&<nav className="report-pagination" aria-label="Loaded report pages"><button type="button" disabled={currentPage===0} onClick={()=>setPage(old=>old-1)}>Previous</button><span>Page {currentPage+1} of {pageCount}</span><button type="button" disabled={currentPage+1>=pageCount} onClick={()=>setPage(old=>old+1)}>Next</button></nav>}
    </>:<div className="workspace-empty"><Icon name="document"/><h2>{rows.length?'No matching reports':'No shared reports in this patient group'}</h2><p>{rows.length?'Try another patient, date range or document type.':'Shared records will appear here when a patient authorizes them.'}</p></div>}
    <div className="report-table-scope"><p>Search, sorting and filters apply to loaded reports. {filters.from||filters.to?'Reports without period dates are excluded by the date filter.':'Missing dates stay labelled as unavailable.'}</p>{nextCursor&&<Link href={`/reports?cursor=${encodeURIComponent(nextCursor)}`}>Load the next patient group <Icon name="arrow"/></Link>}</div>
  </section>;
}

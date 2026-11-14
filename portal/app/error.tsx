'use client';
import Link from 'next/link';
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className="page-loading" role="alert"><h1>This page could not load.</h1><p>Check your connection and try again.</p><button className="button button-small" onClick={reset}>Try again</button><Link href="/">AIriane home</Link></main>;}

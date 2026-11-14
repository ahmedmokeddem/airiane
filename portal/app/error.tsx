'use client';
export default function ErrorPage({reset}:{reset:()=>void}) { return <main className="empty-state" role="alert"><h1>The workspace could not load</h1><p>No report has been displayed. Try again to check current access.</p><button onClick={reset}>Try again</button></main>; }

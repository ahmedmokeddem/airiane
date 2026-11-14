'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Re-runs the server-rendered page every few seconds so new connections and check-in requests
 * appear without pressing refresh. It only refreshes while this tab is visible, and never overlaps
 * a refresh that is still running. Authorization is re-checked by the server on every refresh.
 */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [updated, setUpdated] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => { if (document.visibilityState === 'visible') { router.refresh(); setUpdated(new Date()); } };
    const start = () => { stop(); timer = setInterval(tick, intervalMs); };
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const onVisibility = () => { if (document.visibilityState === 'visible') { tick(); start(); } else stop(); };
    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [router, intervalMs]);
  return <p className="auto-refresh" role="status" aria-live="off">Live · checks for new requests every {Math.round(intervalMs / 1000)} seconds{updated ? ` · last checked ${updated.toLocaleTimeString()}` : ''}</p>;
}

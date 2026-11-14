"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

/** Refresh server authorization and records only while visible; don't overlap an RSC transition. */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  useEffect(() => {
    if (!pending && inFlight.current) {
      inFlight.current = false;
    }
  }, [pending]);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      if (document.visibilityState !== "visible" || inFlight.current) return;
      inFlight.current = true;
      startTransition(() => router.refresh());
    };
    const stop = () => {
      if (timer) clearInterval(timer);
    };
    const start = () => {
      stop();
      timer = setInterval(tick, intervalMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);
  return (
    <p className="auto-refresh" role="status" aria-live="off">
      {pending
        ? "Refreshing current access…"
        : `Records refresh every ${Math.round(intervalMs / 1000)} seconds while this tab is visible.`}
    </p>
  );
}

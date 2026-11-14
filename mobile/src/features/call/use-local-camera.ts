import { useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export function useLocalCamera(allowed: boolean) {
  const [permission, request] = useCameraPermissions();
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const epoch = useRef(0);
  const permissionPendingRef = useRef(false);
  const resume = useRef<number | null>(null);
  const allowedRef = useRef(allowed);
  // Synchronize the camera hardware lifetime with an external call ending.
  useEffect(() => {
    allowedRef.current = allowed;
    if (!allowed) {
      epoch.current++;
      resume.current = null;
      // External call termination must release native camera hardware.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabled(false);
    }
    return () => {
      // Generation counter, not a DOM ref: invalidate pending permission replies.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      epoch.current++;
      resume.current = null;
    };
  }, [allowed]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (value) => {
      if (value === "active") {
        if (resume.current === epoch.current && allowedRef.current)
          setEnabled(true);
        resume.current = null;
      } else if (!permissionPendingRef.current) {
        epoch.current++;
        resume.current = null;
        setEnabled(false);
      }
      // The Android permission dialog temporarily backgrounds the app. There is
      // no active preview yet; let its result settle before enabling on foreground.
    });
    return () => sub.remove();
  }, []);
  const toggle = async () => {
    if (permissionPendingRef.current) return;
    setError("");
    if (enabled) {
      epoch.current++;
      resume.current = null;
      setEnabled(false);
      return;
    }
    if (!allowed) return;
    const current = ++epoch.current;
    permissionPendingRef.current = true;
    setPending(true);
    try {
      const result = permission?.granted ? permission : await request();
      if (current === epoch.current && allowedRef.current) {
        if (result.granted) {
          if (AppState.currentState === "active") setEnabled(true);
          else resume.current = current;
        } else setError("Camera access is off. Your voice call can continue.");
      }
    } catch {
      setError("Preview unavailable. Your voice call can continue.");
    } finally {
      permissionPendingRef.current = false;
      setPending(false);
    }
  };
  const isPermissionPending = useCallback(
    () => permissionPendingRef.current,
    [],
  );
  return {
    enabled: allowed && enabled && !!permission?.granted,
    pending,
    error,
    toggle,
    isPermissionPending,
  };
}

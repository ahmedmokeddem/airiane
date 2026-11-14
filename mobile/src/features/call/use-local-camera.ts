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
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowedRef = useRef(allowed);
  // Synchronize the camera hardware lifetime with an external call ending.
  useEffect(() => {
    allowedRef.current = allowed;
    if (!allowed) {
      epoch.current++;
      resume.current = null;
      permissionPendingRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPending(false);
      // External call termination must release native camera hardware.
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
        if (resume.current === epoch.current && allowedRef.current) {
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => {
            if (
              resume.current === epoch.current &&
              allowedRef.current &&
              AppState.currentState === "active"
            ) {
              setEnabled(true);
              resume.current = null;
              permissionPendingRef.current = false;
              setPending(false);
            }
          }, 300);
        }
      } else if (!permissionPendingRef.current) {
        epoch.current++;
        resume.current = null;
        setEnabled(false);
      }
      // The Android permission dialog temporarily backgrounds the app. There is
      // no active preview yet; let its result settle before enabling on foreground.
    });
    return () => {
      sub.remove();
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
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
          resume.current = current;
          if (AppState.currentState === "active") {
            settleTimer.current = setTimeout(() => {
              if (
                current === epoch.current &&
                allowedRef.current &&
                AppState.currentState === "active"
              ) {
                setEnabled(true);
                resume.current = null;
                permissionPendingRef.current = false;
                setPending(false);
              }
            }, 300);
          }
        } else setError("Camera access is off. Your voice call can continue.");
      }
    } catch {
      setError("Preview unavailable. Your voice call can continue.");
    } finally {
      if (resume.current === null) {
        permissionPendingRef.current = false;
        setPending(false);
      }
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
    fail: () => {
      epoch.current++;
      resume.current = null;
      permissionPendingRef.current = false;
      setPending(false);
      setEnabled(false);
      setError(
        "Camera preview could not start. Tap the camera control to try again. Your voice call can continue.",
      );
    },
  };
}

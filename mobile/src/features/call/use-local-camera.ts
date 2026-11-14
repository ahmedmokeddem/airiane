import { useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

export function useLocalCamera(allowed: boolean) {
  const [permission, request] = useCameraPermissions();
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Denied for good: the OS will not prompt again, only system settings can change it.
  const [settingsRequired, setSettingsRequired] = useState(false);
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
    setSettingsRequired(false);
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
          // Let the just-returned-from-background state settle (avoids a flash /
          // race where the camera mounts a beat before the OS finishes handing
          // focus back after the permission dialog) before actually enabling.
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
        } else if (result.canAskAgain) {
          setError("Camera access is off. Your voice call can continue.");
        } else {
          // No further in-app prompt is possible: point at system settings.
          setSettingsRequired(true);
          setError(
            "Camera access is off in your settings. Your voice call can continue.",
          );
        }
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
  // The preview itself could not start (no camera, hardware busy, unsupported
  // device). Explain it instead of re-running toggle(), which would re-enable
  // the camera whenever `enabled` had already gone false and remount a
  // CameraView that fails the same way.
  const fail = useCallback((message: string) => {
    epoch.current++;
    resume.current = null;
    setEnabled(false);
    setError(message);
  }, []);
  const openSettings = useCallback(() => {
    // react-native-web has no openSettings(); the browser owns this permission.
    if (Platform.OS === "web") return;
    void Promise.resolve()
      .then(() => Linking.openSettings())
      .catch(() => {});
  }, []);
  const isPermissionPending = useCallback(
    () => permissionPendingRef.current,
    [],
  );
  return {
    enabled: allowed && enabled && !!permission?.granted,
    pending,
    error,
    needsSettings: settingsRequired && Platform.OS !== "web",
    toggle,
    fail,
    openSettings,
    isPermissionPending,
  };
}

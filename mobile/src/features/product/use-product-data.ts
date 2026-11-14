import { loadSection } from "./load-section";
import { useCallback, useEffect, useRef, useState } from "react";
import { mode, request } from "../../integration/api";
import type { DTO } from "../../integration/types";
import fixture from "../../../../contracts/fixtures/recommendation.json";
export interface MedicationReminder {
  reminder_id: string;
  patient_id: string;
  clinician_id: string;
  message: string;
  schedule_time: string;
  active: boolean;
  updated_at: string;
}

export function useProductData(signedIn: boolean) {
  const epoch = useRef(0);
  const [profile, setProfile] = useState<DTO<"Me"> | null>(null);
  const [activities, setActivities] = useState<DTO<"Activity">[]>([]);
  const [insights, setInsights] = useState<DTO<"ConfirmedInsight">[]>([]);
  const [medicationReminder, setMedicationReminder] =
    useState<MedicationReminder | null>(null);
  const [hasConnectedDoctor, setHasConnectedDoctor] = useState<boolean>(true);
  const [streak, setStreak] = useState<DTO<"RecoveryStreak"> | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!signedIn) return;
    const current = ++epoch.current;
    setLoading(true);
    setActivitiesLoading(true);
    setError("");
    if (mode === "mock") {
      setActivities(
        fixture.data.options.map((o) => o.activity as DTO<"Activity">),
      );
      setProfile({
        user_id: "11111111-1111-4111-8111-111111111111",
        role: "patient",
        display_name: "Sample patient",
        timezone: "Europe/Helsinki",
        clinician_verified: false,
        avatar: null,
      });
      setInsights([]);
      setLoading(false);
      setActivitiesLoading(false);
      return;
    }
    const isCurrent = () => epoch.current === current;
    const results = await Promise.allSettled([
      loadSection(request<DTO<"Me">>("/me"), isCurrent, setProfile),
      loadSection(request<{ items: DTO<"Activity">[] }>("/activities"), isCurrent,
        value => setActivities(value.items), () => setActivitiesLoading(false)),
      loadSection(request<DTO<"ConfirmedInsightPage">>("/confirmed-insights"), isCurrent,
        value => setInsights(value.items)),
      loadSection(request<{ reminder: MedicationReminder | null }>("/me/medication-reminder"), isCurrent,
        value => setMedicationReminder(value.reminder)),
      loadSection(request<DTO<"CareLinkPage">>("/care-links"), isCurrent,
        value => setHasConnectedDoctor(value.items.some(l => l.state === "active"))),
      loadSection(request<DTO<"RecoveryStreak">>("/me/recovery-streak"), isCurrent, setStreak),
    ]);
    if (!isCurrent()) return;
    if (results.slice(0, 3).some((r) => r.status === "rejected"))
      setError(
        "Some saved records could not be loaded. Please refresh to try again.",
      );
    setLoading(false);
  }, [signedIn]);
  // Authentication changes explicitly reset or hydrate this external API cache.
  useEffect(() => {
    if (signedIn) {
      // Hydrate external authenticated records after an auth transition.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refresh();
    } else {
      // Authentication owns this cache; clear another patient's visible records on sign-out.
      setProfile(null);
      setActivities([]);
      setActivitiesLoading(false);
      setInsights([]);
      setMedicationReminder(null);
      setHasConnectedDoctor(true);
      setStreak(null);
    }
    return () => {
      epoch.current = epoch.current + 1;
    };
  }, [signedIn, refresh]);
  return {
    profile,
    activities,
    insights,
    medicationReminder,
    hasConnectedDoctor,
    streak,
    loading,
    activitiesLoading: activitiesLoading && activities.length === 0,
    error,
    refresh,
  };
}

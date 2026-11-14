import { useEffect, useRef, useState } from "react";
import { mode, request, uuid } from "../../integration/api";
import type { ActivitySession, Recommendation } from "../../integration/types";
import type {
  Definition,
  GenerationRequest,
  Job,
  Progress,
  Transition,
} from "./types";
import { actionFor } from "./types";

/** Generation has no ownership of the provider connection, audio or navigation. */
export function useGeneratedActivities(
  signedIn: boolean,
  activity: ActivitySession | null,
  onContext: (progress: Progress) => void,
) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [proposal, setProposal] = useState<Recommendation | null>(null);
  const activityId = activity?.activity_id;
  const activitySessionId = activity?.activity_session_id;
  const activityState = activity?.state;
  const epoch = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const progressRef = useRef<Progress | null>(null);
  const transitionTail = useRef(Promise.resolve());
  const contextRef = useRef(onContext);
  useEffect(() => {
    contextRef.current = onContext;
  });
  const retry = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    if (!signedIn) {
      void Promise.resolve().then(() => {
        if (active) {
          setEnabled(false);
          setOpen(false);
          setProposal(null);
          setDefinition(null);
          setProgress(null);
          progressRef.current = null;
          epoch.current++;
          abort.current?.abort();
          retry.current = null;
        }
      });
      return () => {
        active = false;
      };
    }
    if (mode === "live")
      void request<{ enabled: boolean }>("/activity-generation/capabilities")
        .then((r) => {
          if (active) setEnabled(r.enabled);
        })
        .catch(() => {
          if (active) setEnabled(false);
        });
    return () => {
      active = false;
    };
  }, [signedIn]);
  useEffect(() => {
    let current = true;
    void Promise.resolve().then(() => {
      if (current) {
        setDefinition(null);
        setProgress(null);
        setError("");
        progressRef.current = null;
      }
    });
    if (
      !enabled ||
      !activityId ||
      !activitySessionId ||
      activityState !== "started"
    )
      return;
    // Ordinary activities have no private definition; their existing player stays unchanged.
    void request<{ definition: Definition }>(
      `/generated-activities/${activityId}`,
    )
      .then(async (d) => {
        const p = await request<Progress>(
          `/activity-sessions/${activitySessionId}/generated-progress`,
        );
        if (current) {
          setDefinition(d.definition);
          setProgress(p);
          progressRef.current = p;
          contextRef.current(p);
        }
      })
      .catch((e) => {
        if (
          current &&
          !(e instanceof Error && e.message.includes("RESOURCE_NOT_FOUND"))
        )
          setError(
            "We couldn’t open this activity. Please retry, or return to your conversation.",
          );
      });
    return () => {
      current = false;
    };
  }, [enabled, activityId, activitySessionId, activityState, loadRevision]);
  async function generate(
    sessionId: string,
    input: GenerationRequest,
  ): Promise<Job | null> {
    if (!enabled) throw new Error("Created activities are not available.");
    const serial = ++epoch.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setBusy(true);
    setError("");
    const body = JSON.stringify(input);
    if (retry.current?.body !== body) retry.current = { body, key: uuid() };
    try {
      let result = await request<Job>(
        `/conversation-sessions/${sessionId}/generated-activities`,
        input,
        "POST",
        retry.current.key,
        controller.signal,
      );
      // A retry may meet the original still-running reservation. Poll the owned job, no inference retry.
      for (
        let i = 0;
        result.state === "generating" && i < 12 && serial === epoch.current;
        i++
      ) {
        await new Promise((r) => setTimeout(r, 1000));
        result = await request<Job>(
          `/conversation-sessions/${sessionId}/activity-generation/${result.job_id}`,
        );
      }
      if (serial !== epoch.current) {
        if (result.state === "generating")
          await request(
            `/conversation-sessions/${sessionId}/activity-generation/${result.job_id}`,
            undefined,
            "DELETE",
          );
        return null;
      }
      if (result.state === "generating")
        throw new Error("Still creating. Retry to check the same request.");
      retry.current = null;
      if (result.recommendation) {
        setProposal(result.recommendation);
        setOpen(false);
      }
      if (result.state === "cancelled")
        setError(
          "Creation stopped. Your familiar choices are still available.",
        );
      if (result.state === "fallback")
        setError(
          "Creation is unavailable right now. Here are familiar choices instead.",
        );
      return result;
    } catch (e) {
      if (serial !== epoch.current) return null;
      setError(
        "We couldn’t finish creating this moment. Your familiar activities are still available.",
      );
      throw e;
    } finally {
      clearTimeout(timeout);
      if (serial === epoch.current) setBusy(false);
    }
  }
  async function change(
    action: Transition["action"],
    extra: Partial<Transition> = {},
    voice = false,
  ): Promise<Progress> {
    const p = progressRef.current;
    if (!p || !activity) throw new Error("No active created activity.");
    const payload = actionFor(p, action, extra);
    const pending = transitionTail.current.then(async () => {
      try {
        const next = await request<Progress>(
          `/activity-sessions/${p.activity_session_id}/${voice ? "generated-voice-choice" : "generated-progress"}`,
          payload,
        );
        progressRef.current = next;
        setProgress(next);
        contextRef.current(next);
        setError("");
        return next;
      } catch (e) {
        const fresh = await request<Progress>(
          `/activity-sessions/${p.activity_session_id}/generated-progress`,
        ).catch(() => null);
        if (fresh) {
          progressRef.current = fresh;
          setProgress(fresh);
          contextRef.current(fresh);
        }
        setError(
          e instanceof Error && e.message.includes("PATTERN_TRY_AGAIN")
            ? "Try the pattern again, or skip it. There is no score."
            : "Your place may have changed. The latest step is shown; please try again.",
        );
        throw e;
      }
    });
    transitionTail.current = pending.then(
      () => {},
      () => {},
    );
    return pending;
  }
  async function decline() {
    const id = proposal?.options[0]?.activity.config.generated_activity_id;
    if (id) await request(`/generated-activities/${id}`, undefined, "DELETE");
    setProposal(null);
    setError("");
  }
  function cancel() {
    epoch.current++;
    abort.current?.abort();
    retry.current = null;
    setBusy(false);
    setOpen(false);
  }
  return {
    getProgress: () => progressRef.current,
    reload: () => setLoadRevision((n) => n + 1),
    enabled,
    open,
    setOpen,
    busy,
    error,
    definition,
    progress,
    proposal,
    generate,
    change,
    decline,
    cancel,
  };
}

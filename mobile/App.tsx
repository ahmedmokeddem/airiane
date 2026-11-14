import "./src/features/opening/splash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { OpeningExperience } from "./src/features/opening/opening-experience";
import { useStartupReady } from "./src/features/opening/use-startup-ready";
import { Slot, usePathname, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  ProductShell,
  ScreenScroll,
  Brand,
  Button,
  s as productStyles,
} from "./src/features/product/product-ui";
import {
  HomeScreen,
  ChatScreen,
  ActivitiesScreen,
  ProfileScreen,
  WelcomeScreen,
  BreathingScreen,
} from "./src/features/product/product-screens";
import { useProductData } from "./src/features/product/use-product-data";
import { JourneyScreen } from "./src/features/journey";
import {
  InsightReview,
  SavedInsights,
  parseInsightProposal,
  type InsightProposal,
} from "./src/features/insights";
import { CallScreen } from "./src/features/call/call-screen";
import {
  nextCompanionState,
  type CompanionState,
} from "./src/features/call/call-state";
import {
  requestVoicePermissions,
  releaseAudio,
} from "./src/features/call/audio-session";
import {
  ElevenProvider,
  type ClientTools,
} from "./src/integration/eleven-provider";
import {
  api,
  mode,
  request,
  setAccessToken,
  uuid,
} from "./src/integration/api";
import { MobileUIBridge } from "./src/integration/mobile-ui-bridge";
import type { VoiceAgentAdapter } from "./src/integration/voice-agent-adapter";
import type {
  ActivitySession,
  Bootstrap,
  DTO,
  Journey,
  Recommendation,
  Session,
} from "./src/integration/types";
import { primeNoiseFilter } from "./src/features/call/noise-filter";
import { ReportsSharing } from "./src/features/reports/reports-sharing";
import { DailyCheckIn } from "./src/features/checkin/daily-check-in";
import { NudgePopup } from "./src/features/nudges/nudge-popup";
import { ReminderSettingsPanel } from "./src/features/nudges/reminder-settings";
import { shouldShowPopup } from "./src/features/nudges/nudge-plan";
import {
  getReminderSettings,
  listenForReminders,
  refreshReminders,
  remindersSupported,
} from "./src/features/nudges/reminders";
import { confirmedOn } from "./src/features/checkin/checkin-state";
import { CheckInProposals } from "./src/features/checkin/check-in-proposals";
import { AssessmentPanel } from "./src/features/assessment/assessment-panel";
import { useAssessment } from "./src/features/assessment/use-assessment";
import {
  checkInUpdate,
  isAffirmative,
  isNegative,
  matchOption,
  wantsAssessment,
  wantsResume,
} from "./src/features/assessment/assessment-flow";
import {
  fields as checkInFields,
  format as formatCheckIn,
  parseAnswer,
  type Kind as CheckInKind,
  type Observation,
} from "./src/features/checkin/checkin-state";
type Screen =
  | "home"
  | "text"
  | "voice"
  | "breathing"
  | "journey"
  | "reports"
  | "activities"
  | "profile";
const realVoice = process.env.EXPO_PUBLIC_VOICE_PROVIDER === "elevenlabs";
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    ...Feather.font,
    PlusJakartaSansDisplay: require("./assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    ManropeBody: require("./assets/fonts/Manrope-Regular.ttf"),
  });
  const startupReady = useStartupReady(fontsLoaded || !!fontError);
  const router = useRouter();
  const pathname = usePathname();
  const screen = (pathname === "/" ? "home" : pathname.slice(1)) as Screen;
  const setScreen = (value: Screen) =>
    router.push(value === "home" ? "/" : (`/${value}` as "/"));
  const [signedIn, setSignedIn] = useState(false);
  const product = useProductData(signedIn);
  const [proposal, setProposal] = useState<InsightProposal | null>(null);
  const insightAck = useRef<(() => void) | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [activity, setActivity] = useState<ActivitySession | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [rating, setRating] = useState(4);
  const [connected, setConnected] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>(
    [],
  );
  const [callState, setCallState] = useState<CompanionState>("idle");
  const [voiceCall, setVoiceCall] = useState(false);
  const voiceCallRef = useRef(false);
  const levelRef = useRef(0);
  const [ending, setEnding] = useState(false);
  const [savedInCall, setSavedInCall] = useState(false);
  const connectEpoch = useRef(0);
  const adapterSubscription = useRef<(() => void) | null>(null);
  const [muted, setMuted] = useState(false);
  const adapter = useRef<VoiceAgentAdapter | null>(null);
  const bridge = useRef<MobileUIBridge | null>(null);
  const closingConnection = useRef<Promise<void>>(Promise.resolve());
  const connection = useRef<DTO<"ProviderConnection"> | null>(null);
  const renderAck = useRef<(() => void) | null>(null);
  const activeGate = useRef<Promise<void>>(Promise.resolve());
  const activityRef = useRef<ActivitySession | null>(null);
  // Bumped whenever a check-in answer may be waiting for the patient's confirmation.
  const [proposalsKey, setProposalsKey] = useState(0);
  // Simulated companion only: the check-in question currently being asked.
  const checkInKind = useRef<CheckInKind | null>(null);
  const say = (textValue: string) =>
    setMessages((m) => [...m, { role: "agent", text: textValue }]);
  const assessment = useAssessment((question, definition, number, total) => {
    const options = (question.options ?? []).map((o) => o.label).join(" · ");
    if (realVoice) {
      // Give the live companion the exact question and options to read aloud.
      try {
        adapter.current?.updateContext(
          JSON.stringify({
            assessment: {
              title: definition.title,
              progress: `${number} of ${total}`,
              question_id: question.question_id,
              question: question.wording,
              options: question.options,
            },
          }),
        );
      } catch {
        setConnected(false);
      }
      return;
    }
    say(`${number} of ${total}. ${question.wording} (${options})`);
  });
  const assessmentRef = useRef(assessment);
  useEffect(() => {
    assessmentRef.current = assessment;
  }, [assessment]);
  // Which conversation flow receives the patient's messages: the daily check-in or the
  // questionnaire. Starting one pauses the other, so neither swallows the other's answers.
  const activeFlow = useRef<"checkin" | "assessment" | null>(null);
  const hasDoctorRef = useRef(false);
  useEffect(() => {
    hasDoctorRef.current = mode === "live" && product.hasConnectedDoctor;
  }, [product.hasConnectedDoctor]);
  // Gentle check-ins without a doctor: an occasional in-app pop-up and optional phone reminders.
  const [nudge, setNudge] = useState<{ checkInDone: boolean; offerReminders: boolean } | null>(null);
  const lastNudgeAt = useRef<number | null>(null);
  const remindersOffered = useRef(false);
  const nudgeState = useRef({ signedIn: false, activeToday: false, blocked: false });
  useEffect(() => {
    try {
      const saved = globalThis.localStorage?.getItem("re.lastNudgeAt");
      if (saved) lastNudgeAt.current = Number(saved);
    } catch {
      /* Storage unavailable: the gap is kept for this session only. */
    }
  }, []);
  const maybeNudge = useCallback(async (force = false) => {
    const { signedIn: inApp, activeToday, blocked } = nudgeState.current;
    if (!inApp || (blocked && !force)) return;
    if (!force && !shouldShowPopup({ now: Date.now(), lastShownAt: lastNudgeAt.current, activeToday }))
      return;
    const today = confirmedOn(await api.observations().catch(() => []), new Date());
    const offerReminders =
      remindersSupported && !remindersOffered.current && !(await getReminderSettings().catch(() => null));
    remindersOffered.current = remindersOffered.current || offerReminders;
    lastNudgeAt.current = Date.now();
    try {
      globalThis.localStorage?.setItem("re.lastNudgeAt", String(lastNudgeAt.current));
    } catch {
      /* Not persisted; still applies now. */
    }
    setNudge({ checkInDone: !!(today.mood && today.energy && today.sleep_hours), offerReminders });
  }, []);
  const assessmentPhase = assessment.state.phase;
  useEffect(() => {
    if (assessmentPhase === "asking") activeFlow.current = "assessment";
    else if (activeFlow.current === "assessment") activeFlow.current = null;
  }, [assessmentPhase]);
  const dispatchTool = useRef<
    | ((
        name: string,
        args: Record<string, unknown>,
      ) => Promise<DTO<"ToolResult">>)
    | null
  >(null);
  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);
  const completeKey = useRef(uuid());
  const feedbackKey = useRef(uuid());
  useEffect(() => {
    renderAck.current?.();
    renderAck.current = null;
  }, [rec]);
  useEffect(() => {
    if (screen !== "breathing" || activity?.state !== "started") return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [screen, activity?.state]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    insightAck.current?.();
    insightAck.current = null;
  }, [proposal]);
  const makeBridge = (s: Session) => {
    const dispatch = async (name: string, args: Record<string, unknown>) => {
      await activeGate.current;
      const c = connection.current;
      if (!c || c.state !== "active")
        throw new Error("Voice connection is not active");
      const id = uuid();
      return request<DTO<"ToolResult">>(
        `/conversation-sessions/${s.session_id}/tools/${name}`,
        {
          connection_id: c.connection_id,
          tool_call_id: id,
          contract_version: "2.0.0",
          arguments: args,
        },
        "POST",
        id,
      );
    };
    dispatchTool.current = dispatch;
    const bridgeApi = {
      recommendations: async (id: string, limit: number) =>
        realVoice
          ? ((await dispatch("present_activity_recommendations", { limit }))
              .result as Recommendation)
          : api.recommendations(id, limit),
      start: async (
        id: string,
        r: Recommendation,
        a: string,
        channel: "voice" | "touch",
      ) => {
        const option = r.options.find((o) => o.activity.activity_id === a)!;
        return realVoice && channel === "voice"
          ? ((
              await dispatch("select_activity", {
                recommendation_id: r.recommendation_id,
                activity_id: a,
                activity_version: option.activity.activity_version,
              })
            ).result as ActivitySession)
          : api.start(id, r, a, channel);
      },
    };
    const value = new MobileUIBridge(
      bridgeApi,
      s.session_id,
      (r) =>
        new Promise<void>((resolve) => {
          renderAck.current = resolve;
          setRec(r);
        }),
      (a) => {
        if (
          activityRef.current?.activity_session_id !== a.activity_session_id
        ) {
          setElapsed(0);
          completeKey.current = uuid();
          feedbackKey.current = uuid();
        }
        activityRef.current = a;
        setActivity(a);
        setSavedInCall(false);
        setScreen("breathing");
      },
    );
    bridge.current = value;
    return value;
  };
  const ensureSession = async (kind: "voice" | "text") => {
    if (session) {
      if (!bridge.current) makeBridge(session);
      return session;
    }
    const created = await api.session(kind);
    setSession(created);
    sessionRef.current = created;
    makeBridge(created);
    return created;
  };
  const login = async (demo = false) => {
    if (mode === "mock") {
      setAccessToken("mock-only");
      setSignedIn(true);
      return;
    }
    if (demo) {
      setAccessToken("demo-patient-token");
    } else {
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key)
        throw new Error(
          "Set Supabase public URL/key, or explicitly enable development demo auth.",
        );
      const result = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.msg ?? "Sign in failed");
      setAccessToken(payload.access_token);
    }
    await request("/me/onboarding", {
      display_name: demo ? "Fictional patient" : email.split("@")[0],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setSignedIn(true);
    setPassword("");
    const savedJourney = await api.journey();
    setJourney(savedJourney);
    const running = savedJourney.items.find(
      (item) => item.activity_session.state === "started",
    );
    if (running) {
      setActivity(running.activity_session);
      activityRef.current = running.activity_session;
      setElapsed(0);
      const parent = await request<Session>(
        `/conversation-sessions/${running.activity_session.session_id}`,
      );
      if (parent.state !== "ended") setSession(parent);
    }
  };
  const closeConnection = useCallback(async () => {
    const current = connection.current;
    connection.current = null;
    setConnected(false);
    if (current && mode === "live") {
      const pending = request(
        `/conversation-sessions/${current.session_id}/agent-connections/${current.connection_id}`,
        { state: "closed", expected_version: current.version },
        "PATCH",
      ).then(() => {});
      closingConnection.current = pending;
      await pending;
    } else await closingConnection.current;
  }, []);
  const receiveAdapter = useCallback((value: VoiceAgentAdapter) => {
    adapter.current = value;
    adapterSubscription.current?.();
    adapterSubscription.current = value.subscribe((event) => {
      if (event.type === "audio_level") {
        levelRef.current = event.level ?? 0;
        return;
      }
      setCallState((current) => nextCompanionState(current, event));
      if (event.type === "disconnected" || event.type === "error") {
        levelRef.current = 0;
        setConnected(false);
      }
    });
  }, []);
  useEffect(
    () => () => {
      adapterSubscription.current?.();
      void adapter.current?.disconnect();
      void releaseAudio().catch(() => {});
    },
    [],
  );
  // Simulated companion: ask the next unanswered check-in question, or offer activities
  // chosen for today's confirmed answers once all three are in.
  const askNextCheckIn = async (sessionId: string, greet = false) => {
    const next = await api.nextCheckInQuestion(sessionId);
    checkInKind.current = next.kind;
    if (next.kind && next.wording) {
      say(
        greet
          ? `Hi, I’m AIriane. Before anything else, a few short questions about today. ${next.wording}`
          : next.wording,
      );
      return;
    }
    if (activeFlow.current === "checkin") activeFlow.current = null;
    say(
      greet
        ? "Welcome back. Your check-in for today is saved. Here are a few small things that might help right now."
        : assessmentRef.current.state.phase === "paused"
          ? "Thank you, that’s today’s check-in saved. Your questionnaire is still waiting whenever you want to continue it."
          : "Thank you, that’s today’s check-in saved. Based on what you shared, here are a few small things that might help. If you’d like a fuller check at some point, just say “full assessment”.",
    );
    await bridge.current?.present();
  };
  const onCheckInDecided = async (observation: Observation) => {
    void product.refresh();
    const label = checkInFields.find((f) => f.kind === observation.kind)!.label;
    if (realVoice) {
      // Tell the live companion what the patient decided so it can continue.
      try {
        adapter.current?.updateContext(
          JSON.stringify({
            check_in: {
              kind: observation.kind,
              value: observation.value,
              patient_decision: observation.state,
            },
          }),
        );
      } catch {
        setConnected(false);
      }
      return;
    }
    if (!checkInKind.current) {
      // A mid-conversation update, not part of the three questions.
      say(
        observation.state === "confirmed"
          ? `Updated. Your ${label.toLowerCase()} for today is now ${formatCheckIn(observation.kind, observation.value)}.`
          : "No problem, I’ve left it as it was.",
      );
      return;
    }
    if (observation.state !== "confirmed")
      say(`No problem, let’s try ${label.toLowerCase()} again.`);
    const parent = sessionRef.current;
    if (parent) await askNextCheckIn(parent.session_id);
  };
  const openConversation = async (kind: "voice" | "text") => {
    // Must run inside the tap, before any await, so the browser allows the audio filter to start.
    if (kind === "voice") primeNoiseFilter();
    const epoch = ++connectEpoch.current;
    voiceCallRef.current = kind === "voice";
    setVoiceCall(kind === "voice");
    setScreen(kind);
    setCallState("connecting");
    setSavedInCall(false);
    setError("");
    await adapter.current?.disconnect();
    await closeConnection();
    setMuted(false);
    if (kind === "voice") await requestVoicePermissions();
    if (epoch !== connectEpoch.current) return;
    const s = await ensureSession(kind);
    if (epoch !== connectEpoch.current) return;
    if (!realVoice) {
      setConnected(true);
      setCallState("listening");
      if (kind === "text") await askNextCheckIn(s.session_id, true);
      else say("Simulated call: ask for help relaxing to see activity suggestions.");
      return;
    }
    if (mode !== "live")
      throw new Error(
        "ElevenLabs requires live FastAPI bootstrap; mock backend cannot issue credentials.",
      );
    // Refresh because session version changes when provider connections are provisioned.
    const fresh = await request<Session>(
      `/conversation-sessions/${s.session_id}`,
    );
    const b = await request<Bootstrap>(
      `/conversation-sessions/${s.session_id}/agent-connections`,
      { mode: kind, expected_version: fresh.version },
    );
    if (epoch !== connectEpoch.current) {
      await request(
        `/conversation-sessions/${s.session_id}/agent-connections/${b.connection_id}`,
        { state: "closed", expected_version: 1 },
        "PATCH",
      );
      return;
    }
    const active = await request<DTO<"ProviderConnection">>(
      `/conversation-sessions/${s.session_id}/agent-connections/${b.connection_id}`,
      { state: "connecting", expected_version: 1 },
      "PATCH",
    );
    connection.current = active;
    let resolveActive: () => void = () => {};
    activeGate.current = new Promise((resolve) => {
      resolveActive = resolve;
    });
    try {
      await adapter.current!.connect(b);
      if (epoch !== connectEpoch.current) {
        resolveActive();
        await adapter.current?.disconnect();
        await closeConnection();
        return;
      }
      connection.current = await request(
        `/conversation-sessions/${s.session_id}/agent-connections/${b.connection_id}`,
        { state: "active", expected_version: active.version },
        "PATCH",
      );
      resolveActive();
      setConnected(true);
    } catch (e) {
      resolveActive();
      await closeConnection();
      await releaseAudio().catch(() => {});
      setCallState("disconnected");
      throw e;
    }
  };
  const tools = useMemo<ClientTools>(
    () => ({
      present_activity_recommendations: async (args) => {
        setCallState("thinking");
        if (!bridge.current)
          throw new Error("Open an application session first");
        return JSON.stringify(await bridge.current.present(Number(args.limit)));
      },
      propose_conversation_insight: async (args) => {
        const fields = parseInsightProposal(args);
        const proposal_id = uuid();
        await new Promise<void>((resolve) => {
          insightAck.current = resolve;
          setProposal({
            ...fields,
            proposal_id,
            session_id: sessionRef.current?.session_id ?? null,
          });
        });
        return JSON.stringify({
          proposal_id,
          state: "awaiting_patient_review",
          persisted: false,
        });
      },
      // Voice can only propose a value or record a request; the patient confirms
      // values in the Daily Check-In card.
      propose_observation: async (args) => {
        if (!dispatchTool.current)
          throw new Error("Open an application session first");
        const result = await dispatchTool.current("propose_observation", {
          kind: args.kind,
          value: args.value,
          observed_at: args.observed_at ?? new Date().toISOString(),
        });
        // Show the confirmation card; the value does not count until the patient confirms.
        setProposalsKey((k) => k + 1);
        return JSON.stringify(result.result);
      },
      request_clinician_review: async () => {
        if (!dispatchTool.current)
          throw new Error("Open an application session first");
        const result = await dispatchTool.current(
          "request_clinician_review",
          {},
        );
        return JSON.stringify(result.result);
      },
      // The questionnaire: voice only highlights an option; the patient taps to record it.
      propose_assessment_answer: async (args) =>
        JSON.stringify({
          highlighted: assessmentRef.current.suggest(
            String(args.question_id),
            Number(args.value),
          ),
          awaiting_patient_confirmation: true,
        }),
      // After the patient says "yes" to the repeated answer, record the highlighted option.
      confirm_assessment_answer: async (args) => {
        const flow = assessmentRef.current.state;
        if (
          flow.phase !== "asking" ||
          flow.question.question_id !== String(args.question_id) ||
          flow.suggested !== Number(args.value)
        )
          return JSON.stringify({
            recorded: false,
            reason: "Highlight the answer with propose_assessment_answer and ask the patient first.",
          });
        const recorded = await assessmentRef.current.confirmSuggested(
          sessionRef.current?.session_id ?? null,
          hasDoctorRef.current,
        );
        return JSON.stringify({ recorded });
      },
      open_assessment: async (args) => {
        const definitions = await assessmentRef.current.offer();
        const wanted = definitions.find((d) =>
          args.assessment === "phq9"
            ? d.title.startsWith("PHQ-9")
            : !d.title.startsWith("PHQ-9"),
        );
        if (wanted) {
          activeFlow.current = "assessment";
          assessmentRef.current.begin(wanted);
        }
        return JSON.stringify({ opened: !!wanted });
      },
      select_activity: async (args) => {
        if (!bridge.current?.recommendation)
          throw new Error("No current recommendations");
        const current = bridge.current.recommendation;
        const chosen = current.options.find(
          (o) => o.activity.activity_id === args.activity_id,
        );
        if (
          current.recommendation_id !== args.recommendation_id ||
          chosen?.activity.activity_version !== args.activity_version
        )
          throw new Error("Stale recommendation/version");
        return JSON.stringify(
          await bridge.current.select(String(args.activity_id), "voice"),
        );
      },
    }),
    [],
  );
  const complete = async () => {
    if (!activity || (mode === "mock" && !rec)) return;
    const saved =
      activity.state === "completed"
        ? activity
        : await api.complete(activity, elapsed, completeKey.current);
    setActivity(saved);
    await api.feedback(saved, rec, rating, feedbackKey.current);
    setJourney(await api.journey());
    void product.refresh();
    setSavedInCall(true);
    setScreen(voiceCallRef.current ? "voice" : "journey");
    try {
      adapter.current?.updateContext(
        JSON.stringify({
          activity_session_id: saved.activity_session_id,
          state: "completed",
          rating,
        }),
      );
    } catch {
      setConnected(false);
    }
  };
  const sendText = async () => {
    const value = text.trim();
    if (!value) return;
    if (!connected) await openConversation("text");
    setMessages((m) => [...m, { role: "user", text: value }]);
    setText("");
    const flow = assessment.state;
    if (flow.phase === "paused" && wantsResume(value)) {
      activeFlow.current = "assessment";
      assessment.resume();
      if (realVoice) adapter.current!.sendText(value);
      return;
    }
    if (flow.phase === "asking" && activeFlow.current === "assessment") {
      if (realVoice) {
        // The live companion highlights and confirms answers through its tools.
        adapter.current!.sendText(value);
        return;
      }
      // Simulated companion: repeat the answer back, then record it when the patient says yes.
      if (flow.suggested !== null && isAffirmative(value)) {
        await assessment.confirmSuggested(sessionRef.current?.session_id ?? null, hasDoctorRef.current);
        return;
      }
      if (flow.suggested !== null && isNegative(value)) {
        assessment.clearSuggestion();
        say("Okay. Which option fits better? You can say it or tap it.");
        return;
      }
      const heard = matchOption(flow.question, value);
      if (heard !== null) assessment.suggest(flow.question.question_id, heard);
      say(
        heard !== null
          ? `I heard “${flow.question.options?.find((o) => o.value === heard)?.label}”. Is that right? Say yes, or tap it.`
          : "Thank you. Which option fits best? You can say it or tap it below.",
      );
      return;
    }
    if (wantsAssessment(value)) {
      await assessment.offer();
      if (realVoice) adapter.current!.sendText(value);
      else
        say(
          "Of course. Here are two optional questionnaires. You can stop at any time, and nothing is saved until you finish.",
        );
      return;
    }
    if (realVoice) adapter.current!.sendText(value);
    else if (!checkInKind.current && checkInUpdate(value)) {
      // Simulated companion: the patient states a new check-in value mid-conversation.
      const update = checkInUpdate(value)!;
      const answer = parseAnswer(update.kind, value);
      if (answer === null) {
        say("I didn’t catch the new number. A rough number is fine.");
        return;
      }
      await api.proposeObservation(update.kind, answer);
      setProposalsKey((k) => k + 1);
      say(
        `Thanks for letting me know. Shall I update your ${checkInFields.find((f) => f.kind === update.kind)!.label.toLowerCase()} to ${formatCheckIn(update.kind, answer)}? You can confirm below.`,
      );
    } else if (checkInKind.current) {
      // Simulated companion: read the answer, then ask the patient to confirm it.
      const kind = checkInKind.current;
      const answer = parseAnswer(kind, value);
      if (answer === null) {
        if (/\bskip\b/i.test(value)) {
          checkInKind.current = null;
          say("That’s okay. We can come back to it whenever you like.");
          await bridge.current!.present();
        } else
          say("I didn’t catch a number there. A rough number is fine, or say skip for now.");
        return;
      }
      await api.proposeObservation(kind, answer);
      setProposalsKey((k) => k + 1);
      say(
        `Thank you. I heard ${formatCheckIn(kind, answer)} for ${checkInFields.find((f) => f.kind === kind)!.label.toLowerCase()}. Is that right? You can confirm below.`,
      );
    } else {
      await bridge.current!.present();
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: "Simulated response: a few gentle options are in the cards below.",
        },
      ]);
    }
  };
  const endCall = async () => {
    if (ending) return;
    connectEpoch.current++;
    setEnding(true);
    setCallState("disconnected");
    voiceCallRef.current = false;
    try {
      await adapter.current?.disconnect();
    } catch {
      /* Always release hardware, even if signaling failed. */
    } finally {
      await releaseAudio().catch(() => {});
      await closeConnection().catch(() => {});
      setVoiceCall(false);
      setEnding(false);
      setScreen("home");
    }
  };
  const leaveCallActivity = async () => {
    if (activity?.state === "started" && mode === "live")
      setActivity(
        await request<ActivitySession>(
          `/activity-sessions/${activity.activity_session_id}/events`,
          {
            client_event_id: uuid(),
            expected_version: activity.version,
            event_type: "abandon",
            elapsed_seconds: elapsed,
            event_at: new Date().toISOString(),
          },
        ),
      );
    setScreen("voice");
  };
  const immersive =
    signedIn && (screen === "voice" || (screen === "breathing" && voiceCall));
  useEffect(() => {
    nudgeState.current = {
      signedIn,
      activeToday: !!product.streak?.active_today,
      // Never interrupt a call, an activity or a questionnaire.
      blocked: immersive || screen === "breathing" || assessment.state.phase === "asking",
    };
  });
  // Shortly after sign-in, and whenever the patient comes back to the app.
  useEffect(() => {
    if (!signedIn || !product.streak) return;
    const timer = setTimeout(() => void maybeNudge(), 1500);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void maybeNudge();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [signedIn, product.streak, maybeNudge]);
  // A tapped phone reminder opens the same gentle check-in.
  useEffect(() => {
    if (!signedIn) return;
    return listenForReminders(() => void maybeNudge(true));
  }, [signedIn, maybeNudge]);
  // Keep reminders topped up; skip today once something calming is done.
  useEffect(() => {
    if (signedIn && product.streak)
      void refreshReminders(product.streak.active_today).catch(() => {});
  }, [signedIn, product.streak]);
  const openText = () => {
    setScreen("text");
    if (connected && connection.current?.mode === "text") return;
    void run(() => openConversation("text"));
  };
  const startCheckIn = () => {
    setScreen("text");
    if (assessment.pause())
      say("I’ve paused your questionnaire. You can continue it any time after the check-in.");
    activeFlow.current = "checkin";
    void run(async () => {
      const already = connected && connection.current?.mode === "text";
      if (!already && !(connected && !realVoice)) await openConversation("text");
      else if (!realVoice && sessionRef.current)
        await askNextCheckIn(sessionRef.current.session_id);
      if (realVoice) {
        const opener = "I’d like to do my daily check-in.";
        setMessages((m) => [...m, { role: "user", text: opener }]);
        adapter.current!.sendText(opener);
      }
    });
  };
  // Open the chat for something the patient chose on Home.
  const openChatFor = (simulatedLine: string, liveLine: string, then?: () => Promise<unknown>) => {
    setScreen("text");
    void run(async () => {
      if (!connected) await openConversation("text");
      if (then) await then();
      if (realVoice) {
        setMessages((m) => [...m, { role: "user", text: liveLine }]);
        adapter.current!.sendText(liveLine);
      } else say(simulatedLine);
    });
  };
  const startUpdate = () =>
    openChatFor(
      "Of course. Tell me the new number, for example “my mood is 6 now” or “I slept 7 hours”.",
      "I’d like to update my check-in.",
    );
  const startAssessment = () => {
    activeFlow.current = "assessment";
    openChatFor(
      "Here are two optional questionnaires. You can stop at any time, and nothing is saved until you finish.",
      "I’d like to do a full assessment.",
      () => assessment.offer(),
    );
  };
  const beginActivity = async (id: string) => {
    if (activity?.state === "started" && activity.activity_id === id) {
      setScreen("breathing");
      return;
    }
    if (activity?.state === "started" && mode === "live") {
      try {
        await request<ActivitySession>(
          `/activity-sessions/${activity.activity_session_id}/events`,
          {
            client_event_id: uuid(),
            expected_version: activity.version,
            event_type: "abandon",
            elapsed_seconds: elapsed,
            event_at: new Date().toISOString(),
          },
        );
      } catch {
        // Ignore if already ended/abandoned on the server.
      }
      activityRef.current = null;
      setActivity(null);
    }
    const parent = await ensureSession("text");
    const eligible = await api.recommendations(parent.session_id, 3, id);
    const inEligible = eligible.options.some((o) => o.activity.activity_id === id);
    const catalogMatch = product.activities.find((a) => a.activity_id === id);
    if (!inEligible && !catalogMatch)
      throw new Error(
        "This activity is not available for this moment. Please choose another.",
      );
    const targetRec = inEligible
      ? eligible
      : {
          ...eligible,
          options: [
            ...eligible.options,
            {
              activity: catalogMatch!,
              rank: eligible.options.length + 1,
              reason: catalogMatch!.description,
            },
          ],
        };
    setRec(targetRec);
    bridge.current!.recommendation = targetRec;
    voiceCallRef.current = false;
    setVoiceCall(false);
    await bridge.current!.select(id, "touch");
  };
  const signOut = async () => {
    await adapter.current?.disconnect();
    await closeConnection();
    setAccessToken("");
    setSignedIn(false);
    setMessages([]);
    setSession(null);
    sessionRef.current = null;
    bridge.current = null;
    setRec(null);
    setActivity(null);
    setJourney(null);
    setProposal(null);
    setScreen("home");
  };
  const friendlyError = error
    ? "This moment could not be completed. Your saved records are safe. Please try again."
    : null;
  const insightPanel = proposal ? (
    <InsightReview
      key={proposal.proposal_id}
      proposal={proposal}
      dark={immersive}
      onDismiss={() => setProposal(null)}
      onSaved={() => {
        setProposal(null);
        void product.refresh();
      }}
    />
  ) : undefined;
  // Check-in confirmations sit above insight review, in chat and on a call alike.
  const reviewPanel = (
    <>
      <AssessmentPanel
        assessment={assessment}
        busy={busy}
        dark={immersive}
        hasDoctor={mode === "live" && product.hasConnectedDoctor}
        onAnswer={(questionId, value) =>
          void run(async () => {
            await assessment.answer(
              questionId,
              value,
              sessionRef.current?.session_id ?? null,
              hasDoctorRef.current,
            );
            void product.refresh();
          })
        }
        onAskCareTeam={() => void run(assessment.askCareTeam)}
        onTryActivity={() =>
          void run(async () => {
            // Suggestions follow the questionnaire's answers (and today's check-in).
            assessment.stop();
            if (bridge.current) await bridge.current.present();
            else setScreen("activities");
          })
        }
      />
      <CheckInProposals
        refreshKey={proposalsKey}
        dark={immersive}
        onDecided={(o) =>
          void onCheckInDecided(o).catch((e) =>
            setError(e instanceof Error ? e.message : "Please retry."),
          )
        }
      />
      {insightPanel}
    </>
  );
  const currentActivity =
    product.activities.find((a) => a.activity_id === activity?.activity_id) ??
    rec?.options.find((o) => o.activity.activity_id === activity?.activity_id)
      ?.activity ??
    journey?.items.find(
      (item) =>
        item.activity_session.activity_session_id ===
        activity?.activity_session_id,
    )?.activity;
  const body = (
    <SafeAreaProvider>
      <OpeningExperience ready={startupReady}>
      <StatusBar style={immersive ? "light" : "dark"} />
      {!startupReady ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#081018",
          }}
        >
          <Brand />
        </View>
      ) : immersive ? (
        <CallScreen
          reviewPanel={reviewPanel}
          state={
            error && callState === "connecting" ? "disconnected" : callState
          }
          levelRef={levelRef}
          connected={connected}
          muted={muted}
          busy={busy}
          ending={ending}
          error={error}
          caption={messages.filter((m) => m.role !== "user").at(-1)?.text ?? ""}
          recommendation={rec}
          activity={activity}
          activityDetail={currentActivity ?? null}
          inActivity={screen === "breathing"}
          elapsed={elapsed}
          rating={rating}
          saved={savedInCall}
          onMute={() => {
            adapter.current?.setMicrophoneMuted(!muted);
            setMuted(!muted);
          }}
          onPause={() => {
            if (connected) {
              adapter.current?.setMicrophoneMuted(true);
              setMuted(true);
              setCallState((current) =>
                current === "disconnected" ? current : "interrupted",
              );
            }
          }}
          onEnd={() => void endCall()}
          onRetry={() => void run(() => openConversation("voice"))}
          onSelect={(id) =>
            void run(async () => {
              await bridge.current!.select(id, "touch");
            })
          }
          onRating={setRating}
          onComplete={() => void run(complete)}
          onLeaveActivity={() => void run(leaveCallActivity)}
        />
      ) : !signedIn ? (
        <WelcomeScreen
          email={email}
          password={password}
          onEmail={setEmail}
          onPassword={setPassword}
          onSignIn={() => void run(() => login())}
          onDemo={
            mode === "mock" || process.env.EXPO_PUBLIC_DEMO_AUTH === "true"
              ? () => void run(() => login(true))
              : undefined
          }
          busy={busy}
          error={friendlyError}
        />
      ) : (
        <ProductShell
          path={pathname}
          onProfile={() => setScreen("profile")}
          onCompanion={openText}
          showHeader={screen !== "text"}
        >
          {screen === "home" && (
            <HomeScreen
              profile={product.profile}
              activities={product.activities}
              journey={journey}
              busy={busy || product.loading}
              onText={openText}
              onVoice={() => void run(() => openConversation("voice"))}
              onActivities={() => setScreen("activities")}
              onJourney={() => setScreen("journey")}
              onProfile={() => setScreen("profile")}
              onBegin={(id) => void run(() => beginActivity(id))}
              onReports={() => setScreen("reports")}
              checkIn={
                <DailyCheckIn
                  onStart={startCheckIn}
                  onUpdate={startUpdate}
                  onAssessment={startAssessment}
                  busy={busy}
                />
              }
              streak={product.streak}
              medication={product.medicationReminder}
              careTeamHint={mode === "live" && !product.hasConnectedDoctor}
            />
          )}
          {screen === "text" && (
            <ChatScreen
              messages={messages}
              value={text}
              onChange={setText}
              onSend={() => void run(sendText)}
              onVoice={() => void run(() => openConversation("voice"))}
              connected={connected}
              busy={busy}
              recommendation={rec}
              onSelect={(id) =>
                void run(async () => {
                  await bridge.current!.select(id, "touch");
                })
              }
              reviewPanel={
                <>
                  {reviewPanel}
                  {!connected && !busy && (
                    <Button label="Connect conversation" onPress={openText} />
                  )}
                </>
              }
              error={friendlyError}
            />
          )}
          {screen === "activities" && (
            <ActivitiesScreen
              activities={product.activities}
              busy={busy || product.loading}
              onBegin={(id) => void run(() => beginActivity(id))}
              onRefresh={() => void product.refresh()}
              error={product.error}
            />
          )}
          {screen === "journey" && (
            <ScreenScroll>
            <JourneyScreen
              journey={journey}
              insights={product.insights}
              loading={busy || product.loading}
              error={product.error}
              onRefresh={() =>
                void run(async () => {
                  setJourney(await api.journey());
                  await product.refresh();
                })
              }
              onExploreActivities={() => setScreen("activities")}
            />
            </ScreenScroll>
          )}
          {screen === "reports" && (
            <ScreenScroll>
              <ReportsSharing />
            </ScreenScroll>
          )}
          {screen === "profile" && (
            <ProfileScreen
              profile={product.profile}
              onSave={(patch) =>
                void run(async () => {
                  await request("/me", patch, "PATCH");
                  await product.refresh();
                })
              }
              onReports={() => setScreen("reports")}
              onSignOut={() => void run(signOut)}
              insightsPanel={
                <>
                  <ReminderSettingsPanel activeToday={!!product.streak?.active_today} />
                  <SavedInsights
                    insights={product.insights}
                    onChanged={product.refresh}
                  />
                </>
              }
            />
          )}
          {screen === "breathing" && activity && currentActivity && (
            <BreathingScreen
              activity={currentActivity}
              elapsed={elapsed}
              rating={rating}
              busy={busy}
              onRating={setRating}
              onComplete={() => void run(complete)}
              onLeave={() =>
                void run(async () => {
                  if (activity.state === "started" && mode === "live")
                    setActivity(
                      await request<ActivitySession>(
                        `/activity-sessions/${activity.activity_session_id}/events`,
                        {
                          client_event_id: uuid(),
                          expected_version: activity.version,
                          event_type: "abandon",
                          elapsed_seconds: elapsed,
                          event_at: new Date().toISOString(),
                        },
                      ),
                    );
                  setScreen("activities");
                })
              }
            />
          )}
          {screen !== "text" && proposal && (
            <View style={{ maxHeight: "42%", padding: 16 }}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {insightPanel}
              </ScrollView>
            </View>
          )}
          {screen !== "text" && friendlyError && (
            <View style={{ padding: 16 }}>
              <Text accessibilityRole="alert" style={productStyles.subtitle}>
                {friendlyError}
              </Text>
            </View>
          )}
          <NudgePopup
            visible={!!nudge && !immersive}
            name={product.profile?.display_name.trim().split(/\s+/)[0]}
            checkInDone={!!nudge?.checkInDone}
            offerReminders={!!nudge?.offerReminders}
            onClose={() => setNudge(null)}
            onCheckIn={() => {
              setNudge(null);
              startCheckIn();
            }}
            onCalm={() => {
              setNudge(null);
              setScreen("text");
              void run(async () => {
                if (!connected) await openConversation("text");
                await bridge.current?.present();
              });
            }}
            onReminders={() => {
              setNudge(null);
              setScreen("profile");
            }}
          />
        </ProductShell>
      )}
      </OpeningExperience>
    </SafeAreaProvider>
  );
  return (
    <>
      <Slot />
      {realVoice ? (
        <ElevenProvider
          tools={tools}
          onAdapter={receiveAdapter}
          onMessage={(role, value) =>
            setMessages((m) => [...m, { role, text: value }])
          }
          onDisconnected={() => {
            void closeConnection().catch(() =>
              setError("Connection closed; retry lifecycle update."),
            );
          }}
        >
          {body}
        </ElevenProvider>
      ) : (
        body
      )}
    </>
  );
}

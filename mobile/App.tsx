import "./src/features/opening/splash";
import {CompanionControls} from "./src/features/companion/companion-controls";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import {carryApprovedRecap} from "./src/features/companion/handoff";
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
import { ReportsSharing } from "./src/features/reports/reports-sharing";
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
  const [handoffDraft, setHandoffDraft] = useState<string|null>(null);
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
  const openConversation = async (kind: "voice" | "text") => {
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
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: "Simulated agent: ask for help relaxing, or display activity recommendations.",
        },
      ]);
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
      get_patient_context: async () => JSON.stringify(await request('/patient-context')),
      get_next_guided_question: async () => {
        const id = sessionRef.current?.session_id;
        if (!id) throw new Error('Open a session first.');
        return JSON.stringify(await request(`/conversation-sessions/${id}/guided-question`));
      },
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
    if (realVoice) adapter.current!.sendText(value);
    else {
      await bridge.current!.present();
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: "Simulated response: Calm Breathing is available in the card below.",
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
  const openText = () => {
    setScreen("text");
    if (connected && connection.current?.mode === "text") return;
    void run(() => openConversation("text"));
  };
  const beginActivity = async (id: string) => {
    if (activity?.state === "started" && activity.activity_id === id) {
      setScreen("breathing");
      return;
    }
    const parent = await ensureSession("text");
    const eligible = await api.recommendations(parent.session_id, 3);
    if (!eligible.options.some((o) => o.activity.activity_id === id))
      throw new Error(
        "This activity is not available for this moment. Please choose another.",
      );
    setRec(eligible);
    bridge.current!.recommendation = eligible;
    voiceCallRef.current = false;
    setVoiceCall(false);
    await bridge.current!.select(id, "touch");
  };
  const signOut = async () => {
    connectEpoch.current++;
    await adapter.current?.disconnect();
    await closeConnection();
    setAccessToken("");
    setSignedIn(false);
    setMessages([]);
    setHandoffDraft(null);
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
  const refreshCompanionContext = async () => {
    await product.refresh();
    if (process.env.EXPO_PUBLIC_COMPANION_V2 === 'true') {
      const latest = await request<DTO<'CompanionContext'>>('/companion');
      adapter.current?.updateContext(JSON.stringify({companion_context:latest,application_time:new Date().toISOString()}));
    }
  };
  const reviewPanel = proposal ? (
    <InsightReview
      key={proposal.proposal_id}
      proposal={proposal}
      dark={immersive}
      onDismiss={() => {
        setProposal(null);
        adapter.current?.updateContext(JSON.stringify({event:'patient_rejected_note',persisted:false}));
      }}
      onSaved={(saved) => {
        setProposal(null);
        adapter.current?.updateContext(JSON.stringify({event:'patient_confirmed_note',persisted:true,insight_id:saved.insight_id}));
        void refreshCompanionContext().catch(()=>{});
      }}
    />
  ) : undefined;
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
            />
          )}
          {screen === "text" && (
            <ChatScreen
              messages={messages}
              value={text}
              onChange={setText}
              onSend={() => void run(sendText)}
              onVoice={() => {
                if(process.env.EXPO_PUBLIC_COMPANION_V2==='true')setHandoffDraft('');
                else void run(() => openConversation('voice'));
              }}
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
                  {handoffDraft!==null && <View style={{gap:10,padding:12}}>
                    <Text style={productStyles.subtitle}>Continue by voice</Text>
                    <Text style={productStyles.small}>Optionally write a recap to share with the voice AI. Sending it does not create a saved note. Your previous chat is not automatically replayed.</Text>
                    <TextInput accessibilityLabel="Optional voice recap" multiline maxLength={1500} value={handoffDraft} onChangeText={setHandoffDraft} placeholder="What would you like to carry into voice?" style={{padding:12,borderWidth:1,borderRadius:12}}/>
                    <Button label="Send recap & switch to voice" disabled={busy||!handoffDraft.trim()} onPress={()=>void run(async()=>{
                      const text=handoffDraft;setHandoffDraft(null);
                      const expectedEpoch=connectEpoch.current+1;
                      await carryApprovedRecap({text,confirmation:true},async()=>{
                        await openConversation('voice');
                        if(connectEpoch.current!==expectedEpoch||connection.current?.state!=='active'||connection.current.mode!=='voice')throw new Error('Voice connection was cancelled. Your recap was not sent.');
                      },message=>adapter.current!.sendText(message));
                    })}/>
                    <Button secondary label="Switch without a recap" disabled={busy} onPress={()=>{setHandoffDraft(null);void run(()=>openConversation('voice'));}}/>
                    <Button secondary label="Keep chatting here" disabled={busy} onPress={()=>setHandoffDraft(null)}/>
                  </View>}
                  {process.env.EXPO_PUBLIC_COMPANION_V2 === 'true' && <CompanionControls sessionId={session?.session_id ?? null} onChanged={()=>void refreshCompanionContext().catch(()=>{})}/>}
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
                  {process.env.EXPO_PUBLIC_COMPANION_V2==='true' && <CompanionControls sessionId={session?.session_id ?? null} onChanged={()=>void refreshCompanionContext().catch(()=>{})}/>}
                  <SavedInsights insights={product.insights} onChanged={()=>void refreshCompanionContext().catch(()=>{})}/>
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
                {reviewPanel}
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

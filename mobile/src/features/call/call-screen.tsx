import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { CameraView } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ActivitySession, Recommendation } from "../../integration/types";
import type { CompanionState } from "./call-state";
import { routeNames, stateLabels } from "./call-state";
import { Companion, AudioWave } from "./companion";
import { CallControls } from "./call-controls";
import { useLocalCamera } from "./use-local-camera";
import { useAudioRoutes } from "./use-audio-routes";
import { noiseFilterSupported } from "./noise-filter";
import {
  NOISE_FILTER_MODES,
  setNoiseFilterMode,
  useNoiseFilterMode,
} from "./noise-filter-mode";
import { activityCue, type ActivityDetail } from "../activity/activity-cues";
import {
  NATURE_SOUNDSCAPES,
  type NatureSoundscapeId,
  useAudioTherapy,
} from "../activity/audio-therapy";
type Props = {
  reviewPanel?: import("react").ReactNode;
  state: CompanionState;
  levelRef: { current: number };
  connected: boolean;
  muted: boolean;
  busy: boolean;
  ending: boolean;
  error: string;
  caption: string;
  recommendation: Recommendation | null;
  activity: ActivitySession | null;
  activityDetail?: ActivityDetail | null;
  inActivity: boolean;
  elapsed: number;
  rating: number;
  saved: boolean;
  onMute: () => void;
  onEnd: () => void;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onRating: (n: number) => void;
  onComplete: () => void;
  onLeaveActivity: () => void;
  onPause: () => void;
};
export function CallScreen(p: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [routesOpen, setRoutesOpen] = useState(false);
  // A disconnected native session must not reopen the route menu on retry.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!p.connected) setRoutesOpen(false);
  }, [p.connected]);
  const camera = useLocalCamera(!p.ending && p.state !== "disconnected");
  const isPermissionPending = camera.isPermissionPending;
  const routes = useAudioRoutes(p.connected && !p.ending);
  const filterMode = useNoiseFilterMode();
  const [seconds, setSeconds] = useState(0);
  const start = useRef(0);
  useEffect(() => {
    if (!p.connected) return;
    start.current = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - start.current) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [p.connected]);
  const onEnd = useRef(p.onEnd);
  const onPause = useRef(p.onPause);
  useEffect(() => {
    onEnd.current = p.onEnd;
    onPause.current = p.onPause;
  }, [p.onEnd, p.onPause]);
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      Alert.alert("Leave this moment?", "End your voice call?", [
        { text: "Keep talking", style: "cancel" },
        {
          text: "End call",
          style: "destructive",
          onPress: () => onEnd.current(),
        },
      ]);
      return true;
    });
    const app = AppState.addEventListener("change", (value) => {
      if (value !== "active" && !isPermissionPending()) onPause.current();
    });
    return () => {
      back.remove();
      app.remove();
    };
  }, [isPermissionPending]);
  const small = height < 740 || p.inActivity || !!p.recommendation;
  // Title, prompts and length come from the selected catalog activity.
  const cue = activityCue(p.activityDetail, p.elapsed);
  const sound = useAudioTherapy(
    p.inActivity && !!p.activity && p.elapsed < cue.duration,
    p.activityDetail,
    p.elapsed,
    { inCall: true },
  );
  const lastCaption = p.inActivity
    ? cue.cue
    : p.caption.replace(
        /\[(?:warmly|calm|calmly|gentle|gently|softly|cheerful|thoughtful)\]\s*/gi,
        "",
      );
  const natureTheme =
    p.inActivity && p.activityDetail?.kind === "nature"
      ? sound.theme
      : undefined;
  return (
    <View
      testID="immersive-call"
      style={[
        s.root,
        natureTheme && { backgroundImage: natureTheme.bgGradient },
      ]}
    >
      <StatusBar style="light" />
      <View
        pointerEvents="none"
        style={[
          s.horizon,
          natureTheme && { backgroundImage: natureTheme.horizonColor },
        ]}
      />
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={s.brand}>AIriane</Text>
          <Text style={s.subtitle}>A LITTLE SPACE FOR YOU</Text>
        </View>
        <View style={s.timer}>
          <View
            style={[
              s.dot,
              { backgroundColor: p.connected ? "#a3eee2" : "#a99bea" },
            ]}
          />
          <Text style={s.time}>
            {p.connected
              ? `${Math.floor(seconds / 60)
                  .toString()
                  .padStart(
                    2,
                    "0",
                  )}:${(seconds % 60).toString().padStart(2, "0")}`
              : p.ending
                ? "ENDING"
                : "VOICE CALL"}
          </Text>
        </View>
      </View>
      <View style={s.stage}>
        <View style={s.companion}>
          <Companion
            state={p.state}
            levelRef={p.levelRef}
            accentTheme={natureTheme}
            size={
              small
                ? Math.min(width * 0.36, height * 0.16, 140)
                : Math.min(width * 0.52, 224)
            }
          />
          <Text accessibilityLiveRegion="polite" style={s.state}>
            {p.muted && p.connected
              ? "Microphone paused"
              : stateLabels[p.state]}
          </Text>
          <AudioWave levelRef={p.levelRef} active={p.connected} />
        </View>
        {camera.enabled && (
          <View testID="local-camera-pip" style={s.pip}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="front"
              mode="picture"
              mute
              onMountError={camera.fail}
            />
            <Text style={s.you}>YOU · PREVIEW</Text>
          </View>
        )}
      </View>
      <View
        style={[s.lower, { maxHeight: height * (p.inActivity ? 0.4 : 0.36) }]}
      >
        <ScrollView
          contentContainerStyle={s.panels}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {p.reviewPanel}
          {!!lastCaption && !p.inActivity && (
            <View style={s.caption}>
              <Text style={s.overline}>AIriane</Text>
              <Text numberOfLines={3} style={s.captionText}>
                {lastCaption}
              </Text>
            </View>
          )}
          {p.inActivity && p.activity && (
            <View testID="call-activity" style={s.activity}>
              <Text style={s.overline}>{cue.eyebrow}</Text>
              <Text style={s.title}>{cue.title}</Text>
              <Text accessibilityLiveRegion="polite" style={s.breath}>
                {p.elapsed >= cue.duration
                  ? "A moment for yourself."
                  : lastCaption}
              </Text>
              <Pressable
                testID="call-soundscape-toggle"
                accessibilityRole="button"
                onPress={sound.toggleSound}
                style={s.quiet}
              >
                <Text style={s.detail}>
                  {sound.soundMuted
                    ? "Soundscape muted · tap to unmute"
                    : p.activityDetail?.kind === "nature"
                      ? `Soundscape · ${NATURE_SOUNDSCAPES[sound.soundscape].label} · tap to mute`
                      : `Soundscape · ${sound.profile.label} · tap to mute`}
                </Text>
              </Pressable>
              {p.activityDetail?.kind === "nature" && (
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {(
                    Object.keys(NATURE_SOUNDSCAPES) as NatureSoundscapeId[]
                  ).map((id) => (
                    <Pressable
                      key={id}
                      testID={`soundscape-chip-${id}`}
                      accessibilityRole="button"
                      onPress={() => sound.setSoundscape(id)}
                      style={[
                        s.route,
                        sound.soundscape === id && s.routeChosen,
                        {
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          minHeight: 32,
                          backgroundColor:
                            sound.soundscape === id ? "#65afa533" : "#ffffff0d",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.detail,
                          {
                            color:
                              sound.soundscape === id ? "#c5e9e0" : "#a0b3c3",
                          },
                        ]}
                      >
                        {NATURE_SOUNDSCAPES[id].label}
                      </Text>
                    </Pressable>
                  ))}
                  {sound.playbackError ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={sound.retryPlayback}
                    >
                      <Text style={{ color: "#ffffff" }}>
                        {sound.playbackError} Retry audio
                      </Text>
                    </Pressable>
                  ) : sound.loading ? (
                    <Text style={{ color: "#ffffff" }}>Loading sound…</Text>
                  ) : null}
                  {sound.supportsBilateral && (
                    <Pressable
                      testID="soundscape-bilateral-toggle"
                      accessibilityRole="button"
                      onPress={sound.toggleBilateral}
                      style={[
                        s.route,
                        sound.bilateralEnabled && s.routeChosen,
                        {
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          minHeight: 32,
                          backgroundColor: sound.bilateralEnabled
                            ? "#65afa533"
                            : "#ffffff0d",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.detail,
                          {
                            color: sound.bilateralEnabled
                              ? "#c5e9e0"
                              : "#a0b3c3",
                          },
                        ]}
                      >
                        {sound.bilateralEnabled
                          ? "Bilateral Pan: ON"
                          : "Bilateral Pan: OFF"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`${cue.title} progress`}
                accessibilityValue={{
                  min: 0,
                  max: cue.duration,
                  now: Math.min(p.elapsed, cue.duration),
                }}
                style={s.track}
              >
                <View
                  style={[
                    s.progress,
                    {
                      width: `${Math.min(100, (p.elapsed / cue.duration) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={s.detail}>
                {Math.min(p.elapsed, cue.duration)} / {cue.duration} seconds ·
                Stop whenever you need.
              </Text>
              {p.elapsed >= cue.duration && (
                <>
                  <Text style={s.captionText}>How helpful was this?</Text>
                  <View style={s.ratings}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable
                        key={n}
                        testID={`call-rating-${n}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Helpfulness ${n} of 5`}
                        accessibilityState={{ selected: p.rating === n }}
                        disabled={p.busy}
                        onPress={() => p.onRating(n)}
                        style={[s.rating, p.rating === n && s.chosen]}
                      >
                        <Text style={s.captionText}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    testID="call-complete"
                    accessibilityRole="button"
                    disabled={p.busy}
                    onPress={p.onComplete}
                    style={[s.primary, p.busy && s.disabled]}
                  >
                    <Text style={s.primaryText}>
                      {p.busy ? "Saving your moment…" : "Complete & save"}
                    </Text>
                  </Pressable>
                </>
              )}
              <Pressable
                testID="call-leave-activity"
                accessibilityRole="button"
                disabled={p.busy}
                onPress={p.onLeaveActivity}
                style={s.quiet}
              >
                <Text style={s.detail}>Return to our conversation</Text>
              </Pressable>
            </View>
          )}
          {!p.inActivity && p.saved && (
            <View testID="call-saved" style={s.caption}>
              <Text style={s.overline}>A SMALL STEP, SAVED</Text>
              <Text style={s.captionText}>
                Your {cue.noun} and feedback are in My Journey.
              </Text>
            </View>
          )}
          {!p.inActivity && p.activity?.state === "started" && (
            <Pressable
              testID="call-resume-activity"
              accessibilityRole="button"
              accessibilityLabel={`Continue ${cue.title}`}
              onPress={() => router.push("/breathing")}
              style={s.recommendation}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.cardTitle}>Continue your {cue.noun}</Text>
                <Text style={s.detail}>Your activity is still here.</Text>
              </View>
              <Text style={s.chevron}>›</Text>
            </Pressable>
          )}
          {!p.inActivity &&
            !p.saved &&
            p.recommendation?.options.map((o) => (
              <Pressable
                key={o.activity.activity_id}
                testID={`call-activity-${o.activity.activity_id}`}
                accessibilityRole="button"
                accessibilityLabel={`Begin ${o.activity.title}`}
                disabled={p.busy || !p.connected}
                onPress={() => p.onSelect(o.activity.activity_id)}
                style={({ pressed }) => [
                  s.recommendation,
                  pressed && s.pressed,
                  p.busy && s.disabled,
                ]}
              >
                <View style={s.activityIcon}>
                  <Text style={s.activitySymbol}>
                    {activityCue(o.activity, 0).symbol}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.cardTitle}>{o.activity.title}</Text>
                  <Text style={s.detail}>
                    {o.activity.duration_seconds / 60} min · {o.reason}
                  </Text>
                </View>
                <Text style={s.chevron}>›</Text>
              </Pressable>
            ))}
          {(!!p.error || !!camera.error) && (
            <View style={s.caption}>
              <Text accessibilityRole="alert" style={s.error}>
                {camera.error ||
                  "Something interrupted this moment. Your saved work is safe."}
              </Text>
              {!camera.error && !!p.error && (
                <Text testID="call-error-detail" style={s.detail}>
                  {p.error}
                </Text>
              )}
            </View>
          )}
          {(p.state === "disconnected" || p.state === "idle") && !p.ending && (
            <Pressable
              testID="call-reconnect"
              accessibilityRole="button"
              disabled={p.busy}
              onPress={p.onRetry}
              style={s.quiet}
            >
              <Text style={s.overline}>Reconnect with AIriane</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
      <View
        style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
      >
        {routesOpen && p.connected && (
          <View
            testID="call-audio-options"
            accessibilityLabel="Audio output options"
            style={s.audioOptions}
          >
            <Text style={s.cardTitle}>Call audio</Text>
            <Text style={s.detail}>
              Choose where you hear RE. Headset microphone support depends on
              your device.
            </Text>
            {["auto", ...routes.outputs].map((id) => (
              <Pressable
                key={id}
                testID={`audio-route-${id}`}
                accessibilityRole="button"
                accessibilityState={{
                  selected: routes.selected === id,
                  disabled: routes.changing,
                }}
                disabled={routes.changing}
                onPress={() => void routes.choose(id)}
                style={[s.route, routes.selected === id && s.routeChosen]}
              >
                <Text style={s.captionText}>
                  {id === "auto"
                    ? "Automatic · prefer headset"
                    : (routeNames[id] ?? id)}
                  {routes.selected === id ? "  ✓" : ""}
                </Text>
              </Pressable>
            ))}
            {routes.outputs.length === 0 && (
              <Text style={s.detail}>Use your device’s audio controls.</Text>
            )}
            {!!routes.error && <Text style={s.error}>{routes.error}</Text>}
            <View
              testID="noise-filter-options"
              style={{ gap: 8, marginTop: 6 }}
            >
              <Text style={s.cardTitle}>Background noise filter</Text>
              {noiseFilterSupported ? (
                <>
                  <Text style={s.detail}>
                    Helps AIriane listen to you, not the room. It turns down
                    sound that is much quieter than your voice, such as a TV or
                    people further away.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {NOISE_FILTER_MODES.map((option) => (
                      <Pressable
                        key={option.mode}
                        testID={`noise-filter-${option.mode}`}
                        accessibilityRole="radio"
                        accessibilityLabel={`Noise filter ${option.label}`}
                        accessibilityState={{
                          selected: filterMode === option.mode,
                        }}
                        onPress={() => setNoiseFilterMode(option.mode)}
                        style={[
                          s.route,
                          { flex: 1, alignItems: "center" },
                          filterMode === option.mode && s.routeChosen,
                        ]}
                      >
                        <Text style={s.captionText}>{option.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={s.detail}>
                    {
                      NOISE_FILTER_MODES.find((o) => o.mode === filterMode)
                        ?.detail
                    }
                  </Text>
                </>
              ) : (
                <Text style={s.detail}>
                  Your phone’s built-in voice noise reduction is on for this
                  call.
                </Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              style={s.quiet}
              onPress={() => setRoutesOpen(false)}
            >
              <Text style={s.overline}>Done</Text>
            </Pressable>
          </View>
        )}
        <Text style={s.disclosure}>
          Camera preview only — AIriane cannot see your video yet.
        </Text>
        <CallControls
          muted={p.muted}
          camera={camera.enabled}
          cameraPending={camera.pending}
          cameraAvailable={p.state !== "disconnected"}
          connected={p.connected}
          ending={p.ending}
          onMute={p.onMute}
          onCamera={() => void camera.toggle()}
          onAudio={() => setRoutesOpen((v) => !v)}
          onEnd={p.onEnd}
        />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#050d19",
    backgroundImage:
      "linear-gradient(180deg, #050b17 0%, #102235 48%, #060e1a 100%)",
  },
  horizon: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundImage:
      "radial-gradient(ellipse at 50% 36%, rgba(101,175,165,0.13) 0%, transparent 65%)",
  },
  header: {
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontSize: 25,
    fontWeight: "600",
    color: "#f4faf8",
    letterSpacing: -1,
  },
  subtitle: { fontSize: 9, letterSpacing: 2, color: "#91a9bb", marginTop: 4 },
  timer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: "#ffffff09",
    borderRadius: 30,
  },
  dot: { width: 5, height: 5, borderRadius: 4 },
  time: { color: "#c5e9e0", fontSize: 11, fontVariant: ["tabular-nums"] },
  stage: {
    flex: 1,
    minHeight: 150,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  companion: { alignItems: "center" },
  state: { fontSize: 13, color: "#a3eee2", letterSpacing: 0.4, marginTop: -15 },
  wave: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 14,
  },
  waveBar: { width: 3, borderRadius: 3, backgroundColor: "#65afa5" },
  pip: {
    position: "absolute",
    top: 14,
    right: 24,
    width: 78,
    height: 112,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ffffff40",
    backgroundColor: "#15283b",
  },
  you: {
    color: "#fff",
    fontSize: 8,
    letterSpacing: 0.5,
    alignSelf: "center",
    marginTop: 9,
    backgroundColor: "#00132588",
    padding: 4,
    borderRadius: 5,
  },
  lower: { flexShrink: 1, paddingHorizontal: 22 },
  panels: { gap: 10, paddingBottom: 8 },
  caption: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ffffff13",
    backgroundColor: "#122337d9",
    gap: 8,
  },
  overline: {
    color: "#83c9bd",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  captionText: { color: "#e0e9ef", fontSize: 14, lineHeight: 21 },
  recommendation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#142b3bea",
    borderWidth: 1,
    borderColor: "#65afa54a",
    borderRadius: 22,
  },
  activityIcon: {
    width: 40,
    height: 40,
    backgroundColor: "#65afa51a",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  activitySymbol: { fontSize: 30, color: "#a3eee2" },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#f1f6f8" },
  detail: { fontSize: 11, color: "#a0b3c3", lineHeight: 17 },
  chevron: { fontSize: 28, color: "#a3eee2" },
  bottom: { paddingHorizontal: 20, paddingTop: 10, gap: 12 },
  disclosure: {
    fontSize: 10,
    color: "#91a9bb",
    textAlign: "center",
    lineHeight: 15,
  },
  activity: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#133133e8",
    borderWidth: 1,
    borderColor: "#65afa54a",
    gap: 10,
  },
  title: {
    fontSize: 23,
    color: "#f5faf7",
    fontWeight: "500",
    letterSpacing: -0.5,
  },
  breath: { fontSize: 17, color: "#beeee1" },
  track: {
    height: 4,
    borderRadius: 3,
    backgroundColor: "#ffffff13",
    overflow: "hidden",
  },
  progress: { height: 4, backgroundColor: "#a3eee2" },
  ratings: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  rating: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff10",
  },
  chosen: {
    backgroundColor: "#28766c",
    borderWidth: 1,
    borderColor: "#a3eee2",
  },
  primary: {
    minHeight: 48,
    padding: 14,
    borderRadius: 24,
    backgroundColor: "#a3eee2",
    alignItems: "center",
  },
  primaryText: { fontSize: 14, fontWeight: "600", color: "#102d30" },
  quiet: {
    padding: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { fontSize: 13, lineHeight: 19, color: "#f4c8bf" },
  audioOptions: {
    padding: 16,
    gap: 8,
    backgroundColor: "#142638",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ffffff22",
    position: "absolute",
    bottom: 130,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  route: { padding: 12, minHeight: 44, borderRadius: 14 },
  routeChosen: { backgroundColor: "#65afa527" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
});

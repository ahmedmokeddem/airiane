import {formats} from "../generative/types";
import { useRef, useState, type ReactNode, type ComponentRef } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DTO, Journey, Recommendation } from "../../integration/types";
import { Companion, type CompanionTheme } from "../call/companion";
import { theme as t } from "../../theme";
import { activityCue } from "../activity/activity-cues";
import {
  NATURE_SOUNDSCAPES,
  type NatureSoundscapeId,
  useAudioTherapy,
} from "../activity/audio-therapy";
import {
  Brand,
  Button,
  IconButton,
  ScreenScroll,
  SectionTitle,
  Surface,
  s,
} from "./product-ui";

type Activity = DTO<"Activity">;
const icons: Record<
  Activity["kind"],
  React.ComponentProps<typeof Feather>["name"]
> = {
  breathing: "wind",
  nature: "sun",
  behavioral_activation: "compass",
  reflection: "edit-3",
  social_reconnection: "users",
};
const kindLabels: Record<Activity["kind"], string> = {
  breathing: "Breathing",
  nature: "Nature",
  behavioral_activation: "Small steps",
  reflection: "Reflection",
  social_reconnection: "Connection",
};
const durationLabel = (seconds: number) =>
  seconds < 60 ? `${seconds} sec` : `${Math.ceil(seconds / 60)} min`;
function ErrorNotice({ message }: { message?: string | null }) {
  return message ? (
    <View accessibilityRole="alert" style={p.error}>
      <Text style={p.errorText}>{message}</Text>
    </View>
  ) : null;
}
function Orb({
  size = 140,
  accentTheme,
}: {
  size?: number;
  accentTheme?: CompanionTheme;
}) {
  const level = useRef(0);
  return (
    <Companion
      state="idle"
      levelRef={level}
      size={size}
      accentTheme={accentTheme}
    />
  );
}
export function ActivityTile({
  activity,
  onPress,
  disabled,
  compact = false,
}: {
  activity: Activity;
  onPress: () => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      testID={`activity-${activity.activity_id}`}
      accessibilityRole="button"
      accessibilityLabel={`Begin ${activity.title}, ${durationLabel(activity.duration_seconds)}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        p.activityTile,
        compact && p.compactTile,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.55 },
      ]}
    >
      <View
        style={[
          p.activityIcon,
          {
            backgroundColor:
              activity.kind === "reflection" ? t.softLavender : t.sage,
          },
        ]}
      >
        <Feather name={icons[activity.kind]} color={t.accent} size={24} />
      </View>
      <View style={p.activityCopy}>
        <Text style={s.eyebrow}>
          {durationLabel(activity.duration_seconds)} ·{" "}
          {formats.find(f=>f.id===activity.config.generated_format)?.label??kindLabels[activity.kind]}
        </Text>
        <Text style={p.activityTitle}>{activity.title}</Text>
        <Text style={p.activityDescription}>{activity.description}</Text>
        <Text style={p.begin}>
          Begin <Feather name="arrow-right" size={12} />
        </Text>
      </View>
    </Pressable>
  );
}
export interface HomeScreenProps {
  profile: DTO<"Me"> | null;
  activities: Activity[];
  journey: Journey | null;
  busy: boolean;
  onText: () => void;
  onVoice: () => void;
  onActivities: () => void;
  onJourney: () => void;
  onProfile: () => void;
  onBegin: (id: string) => void;
  onReports: () => void;
  /** Daily check-in card, rendered under the hero. */
  checkIn?: ReactNode;
  /** Consecutive days with at least one completed activity. */
  streak?: { streak_days: number; active_today: boolean } | null;
  /** Daily reminder set by a connected doctor, if any. */
  medication?: { message: string; schedule_time: string } | null;
  /** True when no doctor is connected: show one gentle, optional invitation. */
  careTeamHint?: boolean;
}
export function HomeScreen({
  profile,
  activities,
  journey,
  busy,
  onText,
  onVoice,
  onActivities,
  onJourney,
  onBegin,
  onReports,
  checkIn,
  streak,
  medication,
  careTeamHint,
}: HomeScreenProps) {
  const completed =
    journey?.items.filter((item) => item.activity_session.state === "completed")
      .length ?? 0;
  const firstName = profile?.display_name.trim().split(/\s+/)[0];
  const running = journey?.items.find(
    (item) => item.activity_session.state === "started",
  );
  return (
    <ScreenScroll>
      <View style={p.greeting}>
        <Text style={s.eyebrow}>
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </Text>
        <Text style={s.title}>
          {firstName
            ? `A little space for you, ${firstName}.`
            : "A little space for you."}
        </Text>
        <Text style={s.subtitle}>
          Take your time. No rush, no scores to beat.
        </Text>
      </View>
      {running && (
        <Surface>
          <Text style={s.sectionTitle}>Your quiet moment is waiting</Text>
          <Text style={s.small}>
            Continue {running.activity.title} whenever you are ready.
          </Text>
          <Button
            label="Resume activity"
            onPress={() => onBegin(running.activity.activity_id)}
            disabled={busy}
          />
        </Surface>
      )}
      <View style={p.hero}>
        <View style={p.heroOrb}>
          <Orb />
        </View>
        <Text style={p.heroTitle}>Here, whenever you{"\n"}need.</Text>
        <Text style={p.heroCopy}>
          A quiet conversation, a gentle pause, or just a moment to be yourself.
        </Text>
        <View style={p.heroActions}>
          <View style={p.flex}>
            <Button
              label="Talk with AIriane"
              icon="message-circle"
              onPress={onText}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            testID="start-voice-call"
            accessibilityLabel="Voice Call"
            onPress={onVoice}
            style={p.voiceHero}
          >
            <Feather name="mic" size={16} color="#fff" />
            <Text style={p.voiceHeroText}>Voice Call</Text>
          </Pressable>
        </View>
      </View>
      {streak && (
        <View
          testID="recovery-streak"
          accessible
          accessibilityLabel={
            streak.streak_days > 0
              ? `Recovery streak: ${streak.streak_days} ${streak.streak_days === 1 ? "day" : "days"}`
              : "Recovery streak not started yet"
          }
          style={p.streak}
        >
          <View style={[p.streakBadge, streak.active_today && p.streakBadgeOn]}>
            <Feather
              name="sunrise"
              size={22}
              color={streak.active_today ? "#fff" : t.accent}
            />
          </View>
          <View style={p.flex}>
            <Text style={p.streakCount}>
              {streak.streak_days > 0
                ? `${streak.streak_days}-day recovery streak`
                : "Start your recovery streak"}
            </Text>
            <Text style={s.small}>
              {streak.active_today
                ? "Today counts. One small step was enough."
                : streak.streak_days > 0
                  ? "One small activity today keeps it going. No pressure."
                  : "One small activity a day adds a day. Any activity counts."}
            </Text>
          </View>
        </View>
      )}
      {medication && (
        <Surface style={{ backgroundColor: t.softLavender }}>
          <View style={p.rowBetween}>
            <Text style={s.eyebrow}>FROM YOUR DOCTOR · DAILY</Text>
            <Text style={s.small}>{medication.schedule_time}</Text>
          </View>
          <Text testID="medication-reminder" style={p.activityTitle}>
            {medication.message}
          </Text>
          <Text style={s.small}>
            A reminder your doctor set for you. Ask them before changing how you
            take any medicine.
          </Text>
        </Surface>
      )}
      {checkIn}
      <View style={p.rowBetween}>
        <SectionTitle title="Gentle invitations" />
        <Pressable
          accessibilityRole="button"
          onPress={onActivities}
          style={p.textButton}
        >
          <Text style={p.textLink}>See all</Text>
        </Pressable>
      </View>
      {activities.length ? (
        <View style={p.invitationGrid}>
          {activities.slice(0, 2).map((activity) => (
            <ActivityTile
              key={activity.activity_id}
              activity={activity}
              disabled={busy}
              compact
              onPress={() => onBegin(activity.activity_id)}
            />
          ))}
        </View>
      ) : (
        <Surface>
          <Text style={s.subtitle}>
            {busy
              ? "Finding your available activities…"
              : "Activities will appear here when available."}
          </Text>
          <Button secondary label="Explore activities" onPress={onActivities} />
        </Surface>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onJourney}
        style={p.journeyTeaser}
      >
        <View style={p.journeyIcon}>
          <Feather name="star" color={t.lavender} size={23} />
        </View>
        <View style={p.flex}>
          <Text style={s.eyebrow}>MOMENTS TO KEEP</Text>
          <Text style={p.activityTitle}>Your constellation</Text>
          <Text style={s.small}>
            {completed
              ? `${completed} saved ${completed === 1 ? "activity" : "activities"} in your loaded history`
              : "Your first saved moment is waiting"}
          </Text>
        </View>
        <Feather name="chevron-right" color={t.muted} size={19} />
      </Pressable>
      <Pressable
        testID="open-reports"
        accessibilityLabel="Your reports and sharing"
        accessibilityRole="button"
        onPress={onReports}
        style={p.reportLink}
      >
        <Feather name="file-text" size={18} color={t.accent} />
        <Text style={p.textLink}>Your reports & sharing</Text>
        <Feather name="arrow-up-right" size={16} color={t.accent} />
      </Pressable>
      {careTeamHint && (
        <Text testID="care-team-hint" style={p.centerCopy}>
          You’re doing this in your own way. If you’d ever like your doctor to
          follow along, you can invite them from Reports & sharing. It’s always
          your choice.
        </Text>
      )}
    </ScreenScroll>
  );
}
export interface ChatScreenProps {
  messages: { role: string; text: string }[];
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onVoice: () => void;
  connected: boolean;
  busy: boolean;
  recommendation: Recommendation | null;
  onSelect: (id: string) => void;
  reviewPanel?: ReactNode;
  error?: string | null;
}
export function ChatScreen({
  messages,
  value,
  onChange,
  onSend,
  onVoice,
  connected,
  busy,
  recommendation,
  onSelect,
  reviewPanel,
  error,
}: ChatScreenProps) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  return (
    <KeyboardAvoidingView
      style={p.chat}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={p.chatHeader}>
        <View style={p.chatAvatar}>
          <Feather name="star" size={18} color={t.accent} />
        </View>
        <View style={p.flex}>
          <Text style={p.activityTitle}>Your companion</Text>
          <Text style={s.small}>
            {connected
              ? "Here with you"
              : busy
                ? "Connecting…"
                : "Conversation is disconnected"}
          </Text>
        </View>
        <Button label="Voice" icon="mic" onPress={onVoice} />
      </View>
      <ScrollView
        ref={scroll}
        style={p.flex}
        contentContainerStyle={p.messages}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          scroll.current?.scrollToEnd({ animated: false })
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={p.chatDate}>
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </Text>
        {!messages.length && (
          <View style={p.chatEmpty}>
            <Orb size={96} />
            <Text style={p.emptyTitle}>
              There’s room for whatever’s on your mind.
            </Text>
            <Text style={p.centerCopy}>
              Write a little or a lot. You can ask for a gentle activity
              whenever you like.
            </Text>
          </View>
        )}
        {messages.map((message, index) => {
          const own = message.role === "patient" || message.role === "user";
          return (
            <View
              key={`${index}:${message.role}`}
              style={[p.message, own ? p.ownMessage : p.agentMessage]}
            >
              <Text style={[p.messageLabel, own && { color: "#b9d5d1" }]}>
                {own ? "You" : "AIriane"}
              </Text>
              <Text
                selectable
                style={[p.messageText, own && { color: "#fff" }]}
              >
                {message.text}
              </Text>
            </View>
          );
        })}
        {recommendation && (
          <View style={p.recommendations}>
            <Text style={s.eyebrow}>A GENTLE INVITATION</Text>
            {recommendation.options.map((option) => (
              <ActivityTile
                key={option.activity.activity_id}
                activity={option.activity}
                disabled={busy}
                onPress={() => onSelect(option.activity.activity_id)}
              />
            ))}
          </View>
        )}
        {reviewPanel}
        <ErrorNotice message={error} />
        {busy && (
          <View style={p.thinking}>
            <ActivityIndicator size="small" color={t.accent} />
            <Text style={s.small}>
              {connected ? "Taking a moment…" : "Connecting your conversation…"}
            </Text>
          </View>
        )}
      </ScrollView>
      <View style={p.composer}>
        <TextInput
          testID="chat-input"
          accessibilityLabel="Message AIriane"
          placeholder="What’s on your mind?"
          placeholderTextColor={t.muted}
          value={value}
          onChangeText={onChange}
          multiline
          maxLength={8000}
          style={p.composerInput}
        />
        <Pressable
          testID="send-message"
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !value.trim() || busy || !connected }}
          disabled={!value.trim() || busy || !connected}
          onPress={onSend}
          style={[
            p.send,
            (!value.trim() || busy || !connected) && { opacity: 0.4 },
          ]}
        >
          <Feather name="arrow-up" size={21} color="#fff" />
        </Pressable>
      </View>
      <Text style={p.chatPrivacy}>
        Insights are only kept when you review and confirm them.
      </Text>
    </KeyboardAvoidingView>
  );
}
export interface ActivitiesScreenProps {
  generationPanel?: ReactNode;
  onInvent?: () => void;
  activities: Activity[];
  busy: boolean;
  onBegin: (id: string) => void;
  onRefresh: () => void;
  error?: string | null;
}
export function ActivitiesScreen({
  generationPanel,
  onInvent,
  activities,
  busy,
  onBegin,
  onRefresh,
  error,
}: ActivitiesScreenProps) {
  return (
    <ScreenScroll>
      {generationPanel}
      <View style={p.greeting}>
        <Text style={s.eyebrow}>SELF-PACED SANCTUARY</Text>
        <Text style={s.title}>A pause that fits you.</Text>
        <Text style={s.subtitle}>
          Small, ungraded moments. Choose what feels comfortable, and stop
          whenever you like.
        </Text>
      </View>
      <View style={p.catalogueBanner}>
        <Feather name="wind" size={36} color={t.accent} />
        <View style={p.flex}>
          <Text style={p.activityTitle}>No right way to begin</Text>
          <Text style={s.small}>Your available activities, at your pace.</Text>
        </View>
      </View>
      <ErrorNotice message={error} />
      {busy && !activities.length && <ActivityIndicator color={t.accent} />}
      {!busy && !activities.length && (
        <Surface>
          <Text style={p.emptyTitle}>A little quiet here</Text>
          <Text style={s.subtitle}>
            No activities are available right now. Refresh to check again.
          </Text>
        </Surface>
      )}
      {onInvent && <Button secondary label="Let’s invent something together" icon="edit-3" onPress={onInvent}/>}
      {activities.map((activity) => (
        <ActivityTile
          key={activity.activity_id}
          activity={activity}
          disabled={busy}
          onPress={() => onBegin(activity.activity_id)}
        />
      ))}
      <Button
        secondary
        label={busy ? "Refreshing…" : "Refresh activities"}
        icon="refresh-cw"
        disabled={busy}
        onPress={onRefresh}
      />
    </ScreenScroll>
  );
}
export interface ProfileScreenProps {
  profile: DTO<"Me"> | null;
  onSave: (patch: DTO<"ProfilePatch">) => void;
  onReports: () => void;
  onSignOut: () => void;
  insightsPanel?: ReactNode;
}
export function ProfileScreen(props: ProfileScreenProps) {
  return (
    <ProfileForm
      key={`${props.profile?.user_id}:${props.profile?.display_name}:${props.profile?.timezone}`}
      {...props}
    />
  );
}
function ProfileForm({
  profile,
  onSave,
  onReports,
  onSignOut,
  insightsPanel,
}: ProfileScreenProps) {
  const [name, setName] = useState(profile?.display_name ?? "");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "");
  return (
    <ScreenScroll>
      <Text style={s.eyebrow}>YOUR SPACE</Text>
      <Text style={s.title}>Profile & privacy</Text>
      <View style={p.profileHero}>
        <View style={p.initialCircle}>
          <Text style={p.initial}>
            {profile?.display_name.trim().slice(0, 1).toUpperCase() || "A"}
          </Text>
        </View>
        <Text style={p.emptyTitle}>
          {profile?.display_name || "Your profile"}
        </Text>
        <Text style={s.small}>You choose what to keep and share.</Text>
      </View>
      <Surface>
        <SectionTitle title="Make yourself at home" />
        <Text style={p.fieldLabel}>Your name</Text>
        <TextInput
          accessibilityLabel="Display name"
          value={name}
          onChangeText={setName}
          maxLength={160}
          style={p.input}
        />
        <Text style={p.fieldLabel}>Timezone</Text>
        <TextInput
          accessibilityLabel="Timezone"
          autoCapitalize="none"
          value={timezone}
          onChangeText={setTimezone}
          maxLength={80}
          style={p.input}
        />
        <Button
          label="Save profile"
          disabled={!name.trim() || !timezone.trim()}
          onPress={() =>
            onSave({ display_name: name.trim(), timezone: timezone.trim() })
          }
        />
      </Surface>
      {insightsPanel}
      <Surface>
        <SectionTitle title="Kept with your permission" />
        <View style={p.privacyRow}>
          <Feather name="check-circle" size={21} color={t.accent} />
          <View style={p.flex}>
            <Text style={p.activityTitle}>Your words, your choice</Text>
            <Text style={s.subtitle}>
              Review, edit or reject a proposed insight before it is saved.
              Saved insights can be removed.
            </Text>
          </View>
        </View>
        <View style={p.privacyRow}>
          <Feather name="video-off" size={21} color={t.accent} />
          <View style={p.flex}>
            <Text style={p.activityTitle}>Camera stays with you</Text>
            <Text style={s.subtitle}>
              The optional preview stays on your phone. AIriane cannot see your
              video.
            </Text>
          </View>
        </View>
        <View style={p.privacyRow}>
          <Feather name="lock" size={21} color={t.accent} />
          <View style={p.flex}>
            <Text style={p.activityTitle}>Sharing is a separate choice</Text>
            <Text style={s.subtitle}>
              Connecting a doctor does not automatically share your reports. You
              can stop sharing.
            </Text>
          </View>
        </View>
        <Button
          secondary
          label="Manage reports & sharing"
          icon="file-text"
          onPress={onReports}
        />
      </Surface>
      <Text style={s.small}>
        AIriane is a wellbeing companion. Conversations are not an emergency
        service or a promise of clinician monitoring.
      </Text>
      <Button secondary label="Sign out" icon="log-out" onPress={onSignOut} />
    </ScreenScroll>
  );
}
export interface WelcomeScreenProps {
  email: string;
  password: string;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSignIn: () => void;
  onDemo?: () => void;
  busy: boolean;
  error?: string | null;
}
export function WelcomeScreen({
  email,
  password,
  onEmail,
  onPassword,
  onSignIn,
  onDemo,
  busy,
  error,
}: WelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={p.welcome}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          p.welcomeContent,
          {
            paddingTop: Math.max(24, insets.top + 12),
            paddingBottom: Math.max(36, insets.bottom + 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Brand />
        <View style={p.welcomeAtmosphere}>
          <Orb size={150} />
        </View>
        <View style={p.greeting}>
          <Text style={s.eyebrow}>A GENTLER PLACE TO BEGIN</Text>
          <Text style={[s.title, { fontSize: 34, lineHeight: 43 }]}>
            Find your rhythm.{`\n`}One moment at a time.
          </Text>
          <Text style={s.subtitle}>
            A companion for quiet conversations and small wellbeing activities,
            at your pace.
          </Text>
        </View>
        <Surface>
          <Text style={p.activityTitle}>Welcome to your space</Text>
          <TextInput
            accessibilityLabel="Email address"
            placeholder="Email address"
            placeholderTextColor={t.muted}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChangeText={onEmail}
            style={p.input}
          />
          <TextInput
            accessibilityLabel="Password"
            placeholder="Password"
            placeholderTextColor={t.muted}
            autoComplete="current-password"
            secureTextEntry
            value={password}
            onChangeText={onPassword}
            style={p.input}
          />
          <Button
            label={busy ? "Signing in…" : "Sign in"}
            disabled={busy || !email.trim() || !password}
            onPress={onSignIn}
          />
          {onDemo && (
            <>
              <Button
                secondary
                label="Try a sample"
                disabled={busy}
                onPress={onDemo}
              />
              <Text style={s.small}>
                The sample uses fictional records. It is separate from your
                personal account.
              </Text>
            </>
          )}
          <ErrorNotice message={error} />
        </Surface>
        <Text style={p.centerCopy}>Space to talk. Permission to pause.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export interface BreathingScreenProps {
  activity: Activity;
  elapsed: number;
  rating: number | null;
  busy: boolean;
  onRating: (rating: number) => void;
  onComplete: () => void;
  onLeave: () => void;
}
export function BreathingScreen({
  activity,
  elapsed,
  rating,
  busy,
  onRating,
  onComplete,
  onLeave,
}: BreathingScreenProps) {
  const duration = activity.duration_seconds;
  const finished = elapsed >= duration;
  // Prompts follow the activity kind: breath phases, listening steps or grounding steps.
  const cue = activityCue(activity, elapsed);
  const breathing = activity.kind === "breathing";
  const phase = breathing
    ? cue.cue === "Breathe in gently"
      ? "Breathe in, gently"
      : "Let your breath out"
    : cue.cue;
  const sound = useAudioTherapy(!finished, activity, elapsed);
  const natureTheme = activity.kind === "nature" ? sound.theme : undefined;
  return (
    <ScreenScroll
      style={
        natureTheme ? { backgroundImage: natureTheme.bgGradient } : undefined
      }
    >
      <View style={p.rowBetween}>
        <Text style={s.eyebrow}>A MOMENT FOR YOU</Text>
        <IconButton name="x" label="Leave activity" onPress={onLeave} />
      </View>
      <View style={p.breathing}>
        <Text style={p.breathingTitle}>{activity.title}</Text>
        <Text style={p.heroCopy}>
          {finished
            ? "Your moment is complete."
            : breathing
              ? "Let your shoulders soften. Keep your breath comfortable."
              : activity.description}
        </Text>
        <View style={p.breathingOrb}>
          <Orb size={180} accentTheme={natureTheme} />
        </View>
        <Text accessibilityLiveRegion="polite" style={p.breathingPhase}>
          {finished ? "Take your time returning" : phase}
        </Text>
        <Text style={p.timer}>
          {Math.floor(Math.min(elapsed, duration) / 60)
            .toString()
            .padStart(2, "0")}
          :
          {Math.floor(Math.min(elapsed, duration) % 60)
            .toString()
            .padStart(2, "0")}{" "}
          <Text style={p.timerTotal}>
            /{" "}
            {Math.floor(duration / 60)
              .toString()
              .padStart(2, "0")}
            :{(duration % 60).toString().padStart(2, "0")}
          </Text>
        </Text>
        <View
          style={p.progressTrack}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: duration,
            now: Math.min(elapsed, duration),
          }}
        >
          <View
            style={[
              p.progressFill,
              {
                width: `${Math.max(0, Math.min(1, elapsed / duration)) * 100}%`,
              },
            ]}
          />
        </View>
        {breathing &&
          activity.config.instructions.map((instruction, index) => (
            <Text key={index} style={p.heroCopy}>
              {instruction}
            </Text>
          ))}
        <Pressable
          testID="activity-soundscape-toggle"
          accessibilityRole="button"
          accessibilityLabel={
            sound.soundMuted ? "Unmute soundscape" : "Mute soundscape"
          }
          onPress={sound.toggleSound}
          style={p.textButton}
        >
          <Text style={p.heroCopy}>
            <Feather
              name={sound.soundMuted ? "volume-x" : "volume-2"}
              size={13}
            />{" "}
            {sound.soundMuted
              ? "Soundscape muted · tap to unmute"
              : activity.kind === "nature"
                ? `${NATURE_SOUNDSCAPES[sound.soundscape].label} · tap to mute`
                : `${sound.profile.label} · tap to mute`}
          </Text>
        </Pressable>
        {activity.kind === "nature" && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            {(Object.keys(NATURE_SOUNDSCAPES) as NatureSoundscapeId[]).map(
              (id) => (
                <Pressable
                  key={id}
                  testID={`activity-soundscape-chip-${id}`}
                  accessibilityRole="button"
                  onPress={() => sound.setSoundscape(id)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: sound.soundscape === id ? t.accent : t.border,
                    backgroundColor:
                      sound.soundscape === id ? `${t.accent}22` : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: sound.soundscape === id ? t.accent : t.muted,
                    }}
                  >
                    {NATURE_SOUNDSCAPES[id].label}
                  </Text>
                </Pressable>
              ),
            )}
            {sound.playbackError ? (
              <Pressable
                accessibilityRole="button"
                onPress={sound.retryPlayback}
              >
                <Text style={{ color: "#166a61" }}>
                  {sound.playbackError} Retry audio
                </Text>
              </Pressable>
            ) : sound.loading ? (
              <Text style={{ color: "#166a61" }}>Loading sound…</Text>
            ) : null}
            {sound.supportsBilateral && (
              <Pressable
                testID="activity-soundscape-bilateral-toggle"
                accessibilityRole="button"
                onPress={sound.toggleBilateral}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: sound.bilateralEnabled ? t.accent : t.border,
                  backgroundColor: sound.bilateralEnabled
                    ? `${t.accent}22`
                    : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: sound.bilateralEnabled ? t.accent : t.muted,
                  }}
                >
                  {sound.bilateralEnabled
                    ? "Bilateral Pan: ON"
                    : "Bilateral Pan: OFF"}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      <Surface>
        <SectionTitle title="How did this feel?" />
        <Text style={s.subtitle}>
          Your own sense of helpfulness. There’s no right answer.
        </Text>
        <View style={p.ratings}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`Helpfulness ${value} of 5`}
              testID={`activity-rating-${value}`}
              accessibilityState={{ selected: rating === value }}
              onPress={() => onRating(value)}
              style={[p.ratingOption, rating === value && p.ratingSelected]}
            >
              <Text
                style={[p.ratingText, rating === value && { color: "#fff" }]}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={p.rowBetween}>
          <Text style={s.small}>Not helpful</Text>
          <Text style={s.small}>Very helpful</Text>
        </View>
        <Button
          label={busy ? "Saving your moment…" : "Complete & save"}
          icon="check"
          disabled={busy || !finished || rating === null}
          onPress={onComplete}
        />
        {!finished && (
          <Text style={s.small}>
            You can save after the activity finishes. Stop at any time if
            uncomfortable.
          </Text>
        )}
      </Surface>
      <Text style={p.centerCopy}>
        Saved moments appear in My Journey. No streaks, no pressure.
      </Text>
    </ScreenScroll>
  );
}
const p = StyleSheet.create({
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: t.sage,
  },
  streakBadge: {
    height: 48,
    width: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.surface,
  },
  streakBadgeOn: { backgroundColor: t.accent },
  streakCount: {
    fontFamily: t.type.display,
    fontSize: 16,
    fontWeight: "600",
    color: t.ink,
    lineHeight: 23,
  },
  flex: { flex: 1 },
  greeting: { gap: 9 },
  hero: {
    backgroundColor: t.navy,
    borderRadius: 30,
    padding: 24,
    alignItems: "center",
    gap: 15,
    overflow: "hidden",
  },
  heroOrb: { paddingVertical: 6 },
  heroTitle: {
    minHeight: 60,
    fontFamily: t.type.display,
    fontSize: 21,
    lineHeight: 29,
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  heroCopy: {
    fontFamily: t.type.body,
    color: "#c6d5e3",
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
  },
  heroActions: { flexDirection: "row", gap: 9, width: "100%", marginTop: 4 },
  voiceHero: {
    minHeight: 48,
    flexDirection: "row",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#ffffff30",
    borderRadius: 18,
    backgroundColor: "#ffffff0d",
  },
  voiceHeroText: {
    fontFamily: t.type.body,
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  textButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  textLink: {
    fontFamily: t.type.body,
    color: t.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  invitationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  activityTile: {
    backgroundColor: t.surface,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
    boxShadow: t.shadow,
  },
  compactTile: { flex: 1, minWidth: 140, flexDirection: "column", gap: 13 },
  activityIcon: {
    height: 48,
    width: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  activityCopy: { flex: 1, gap: 8 },
  activityTitle: {
    fontFamily: t.type.display,
    color: t.ink,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
  },
  activityDescription: {
    fontFamily: t.type.body,
    color: t.muted,
    fontSize: 12,
    lineHeight: 20,
  },
  begin: {
    fontFamily: t.type.body,
    color: t.accent,
    fontSize: 12,
    fontWeight: "700",
    paddingTop: 4,
  },
  journeyTeaser: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    gap: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  journeyIcon: {
    height: 48,
    width: 48,
    borderRadius: 16,
    backgroundColor: t.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  reportLink: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  chat: { flex: 1 },
  chatHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: t.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: t.surface,
  },
  chatAvatar: {
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.sage,
  },
  messages: { padding: 20, gap: 18, paddingBottom: 28 },
  chatDate: {
    fontFamily: t.type.body,
    color: t.muted,
    fontSize: 11,
    textAlign: "center",
  },
  chatEmpty: { paddingVertical: 32, gap: 22, alignItems: "center" },
  emptyTitle: {
    fontFamily: t.type.display,
    color: t.ink,
    fontSize: 21,
    lineHeight: 30,
    fontWeight: "600",
    textAlign: "center",
  },
  centerCopy: {
    fontFamily: t.type.body,
    color: t.muted,
    fontSize: 12,
    lineHeight: 21,
    textAlign: "center",
  },
  message: { borderRadius: 23, padding: 17, maxWidth: "90%", gap: 7 },
  ownMessage: {
    alignSelf: "flex-end",
    backgroundColor: t.navy,
    borderBottomRightRadius: 7,
  },
  agentMessage: {
    alignSelf: "flex-start",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderBottomLeftRadius: 7,
  },
  messageLabel: {
    fontFamily: t.type.body,
    color: t.accent,
    fontSize: 10,
    fontWeight: "700",
  },
  messageText: {
    fontFamily: t.type.body,
    color: t.ink,
    fontSize: 14,
    lineHeight: 24,
  },
  recommendations: { gap: 12 },
  thinking: { flexDirection: "row", alignItems: "center", gap: 10 },
  composer: {
    marginHorizontal: 16,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: t.border,
    padding: 7,
    backgroundColor: t.surface,
  },
  composerInput: {
    fontFamily: t.type.body,
    flex: 1,
    minHeight: 43,
    maxHeight: 130,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    color: t.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  chatPrivacy: {
    fontFamily: t.type.body,
    fontSize: 9,
    color: t.muted,
    textAlign: "center",
    paddingVertical: 9,
  },
  catalogueBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    borderRadius: 24,
    padding: 23,
    backgroundColor: t.sage,
  },
  profileHero: { alignItems: "center", gap: 12, paddingVertical: 14 },
  initialCircle: {
    height: 84,
    width: 84,
    borderRadius: 42,
    backgroundColor: t.softLavender,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontFamily: t.type.display, fontSize: 32, color: t.ink },
  fieldLabel: { fontFamily: t.type.body, color: t.muted, fontSize: 12 },
  input: {
    fontFamily: t.type.body,
    minHeight: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    color: t.ink,
    backgroundColor: t.background,
    fontSize: 14,
  },
  privacyRow: { flexDirection: "row", gap: 14, paddingVertical: 9 },
  error: { borderRadius: 16, padding: 15, backgroundColor: "#fae7e2" },
  errorText: {
    fontFamily: t.type.body,
    color: t.error,
    fontSize: 13,
    lineHeight: 21,
  },
  welcome: { flex: 1, backgroundColor: t.background },
  welcomeContent: {
    padding: 24,
    paddingBottom: 36,
    gap: 26,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  welcomeAtmosphere: { alignItems: "center", paddingVertical: 10 },
  breathing: {
    backgroundColor: t.navy,
    borderRadius: 30,
    padding: 25,
    gap: 18,
    alignItems: "center",
  },
  breathingTitle: {
    fontFamily: t.type.display,
    fontSize: 24,
    lineHeight: 33,
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  breathingOrb: { paddingVertical: 18 },
  breathingPhase: {
    fontFamily: t.type.display,
    color: "#fff",
    fontSize: 20,
    textAlign: "center",
  },
  timer: {
    fontFamily: t.type.body,
    fontSize: 24,
    color: t.mint,
    fontVariant: ["tabular-nums"],
  },
  timerTotal: { fontSize: 14, color: "#8da3b9" },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ffffff20",
    width: "100%",
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: t.mint, borderRadius: 2 },
  ratings: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  ratingOption: {
    minWidth: 44,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: t.low,
    flex: 1,
  },
  ratingSelected: { backgroundColor: t.accent },
  ratingText: {
    fontFamily: t.type.body,
    color: t.ink,
    fontSize: 18,
    fontWeight: "600",
  },
});

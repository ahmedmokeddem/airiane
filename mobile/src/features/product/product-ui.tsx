import { Feather } from "@expo/vector-icons";
import {
  useAnimatedValue,
  AccessibilityInfo,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useEffect, useState, type PropsWithChildren } from "react";
import { theme as t } from "../../theme";
import { destinations, selectedTab } from "./navigation";
export function Brand({
  compact = false,
  dark = false,
}: {
  compact?: boolean;
  dark?: boolean;
}) {
  return (
    <Image
      accessible
      accessibilityLabel="AIriane"
      source={
        dark
          ? require("../../../assets/brand/wordmark-plate.png")
          : require("../../../assets/brand/airiane-wordmark.png")
      }
      resizeMode="contain"
      style={{
        maxWidth: "100%",
        width: compact ? 180 : 310,
        height: compact ? 48 : 82,
        alignSelf: "flex-start",
      }}
    />
  );
}
export function IconButton({
  name,
  label,
  onPress,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={s.iconButton}
    >
      <Feather name={name} color={t.ink} size={20} />
    </Pressable>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <Pressable
      testID={label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-$/, "")}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        disabled && s.disabled,
        pressed && { opacity: 0.75 },
      ]}
    >
      {icon && (
        <Feather name={icon} size={16} color={secondary ? t.ink : "white"} />
      )}
      <Text style={[s.buttonText, secondary && { color: t.ink }]}>{label}</Text>
    </Pressable>
  );
}
export function Surface({
  children,
  style,
}: { style?: ViewStyle } & PropsWithChildren) {
  return <View style={[s.surface, style]}>{children}</View>;
}
export function SectionTitle({
  title,
  aside,
}: {
  title: string;
  aside?: string;
}) {
  return (
    <View style={s.sectionHeading}>
      <Text style={s.sectionTitle}>{title}</Text>
      {aside && <Text style={s.small}>{aside}</Text>}
    </View>
  );
}
export function ScreenScroll({ children }: PropsWithChildren) {
  return (
    <ScrollView
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
export function ProductShell({
  children,
  path,
  onProfile,
  onCompanion,
  showHeader = true,
}: PropsWithChildren<{
  path: string;
  onProfile: () => void;
  onCompanion?: () => void;
  showHeader?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const opacity = useAnimatedValue(1);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (reduced) return;
    opacity.setValue(0.86);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [path, opacity, reduced]);
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {showHeader && (
        <View style={s.header}>
          <Brand compact />
          <IconButton
            name="user"
            label="Profile and privacy"
            onPress={onProfile}
          />
        </View>
      )}
      <Animated.View style={[s.main, { opacity }]}>{children}</Animated.View>
      <BottomNavigation path={path} onCompanion={onCompanion} />
    </View>
  );
}
function BottomNavigation({
  path,
  onCompanion,
}: {
  path: string;
  onCompanion?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const selected = selectedTab(path);
  return (
    <View
      accessibilityRole="tablist"
      testID="patient-bottom-navigation"
      style={[s.nav, { paddingBottom: Math.max(12, insets.bottom) }]}
    >
      {destinations.map((d) => (
        <Pressable
          key={d.key}
          testID={`tab-${d.key}`}
          accessibilityRole="tab"
          accessibilityLabel={d.label}
          accessibilityState={{ selected: selected === d.key }}
          onPress={() => {
            if (d.key === "text" && onCompanion) onCompanion();
            else router.replace(d.path as "/");
          }}
          style={s.tab}
        >
          <View style={[s.tabIcon, selected === d.key && s.tabActive]}>
            <Feather
              name={d.icon}
              size={20}
              color={selected === d.key ? t.accent : t.muted}
            />
          </View>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={[
              s.tabLabel,
              selected === d.key && { color: t.accent, fontWeight: "700" },
            ]}
          >
            {d.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background },
  main: { flex: 1 },
  header: {
    height: 68,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.low,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 24,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontFamily: t.type.display,
    fontSize: 28,
    lineHeight: 36,
    color: t.ink,
    fontWeight: "600",
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: t.type.body,
    fontSize: 14,
    lineHeight: 22,
    color: t.muted,
  },
  eyebrow: {
    fontFamily: t.type.body,
    fontSize: 10,
    fontWeight: "700",
    color: t.accent,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: {
    fontFamily: t.type.display,
    color: t.ink,
    fontSize: 17,
    fontWeight: "600",
  },
  small: {
    fontFamily: t.type.body,
    fontSize: 11,
    lineHeight: 17,
    color: t.muted,
  },
  surface: {
    backgroundColor: t.surface,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.border,
    gap: 12,
    boxShadow: t.shadow,
  },
  button: {
    minHeight: 48,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondary: { backgroundColor: t.low, borderWidth: 1, borderColor: t.border },
  disabled: { opacity: 0.45 },
  buttonText: {
    fontFamily: t.type.body,
    fontSize: 13,
    fontWeight: "700",
    color: "white",
  },
  nav: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingTop: 9,
    borderTopWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
  },
  tab: { flex: 1, alignItems: "center", gap: 3, minHeight: 52 },
  tabIcon: {
    width: 55,
    height: 30,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: t.sage },
  tabLabel: { fontFamily: t.type.body, fontSize: 10, color: t.muted, textAlign: "center", alignSelf: "stretch" },
});

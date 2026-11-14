import { Pressable, StyleSheet, Text, View } from "react-native";
type IconName = "mic" | "camera" | "audio" | "end";
function Icon({ name, off }: { name: IconName; off?: boolean }) {
  const color = name === "end" ? "#fff" : "#e6fcf5";
  return (
    <View
      style={s.icon}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {name === "mic" ? (
        <>
          <View style={[s.mic, { borderColor: color }]} />
          <View style={[s.micStand, { borderColor: color }]} />
        </>
      ) : name === "camera" ? (
        <>
          <View style={[s.camera, { borderColor: color }]} />
          <View style={[s.lens, { borderColor: color }]} />
        </>
      ) : name === "audio" ? (
        <>
          <View style={[s.headset, { borderColor: color }]} />
          <View style={[s.ear, { left: 2, backgroundColor: color }]} />
          <View style={[s.ear, { right: 2, backgroundColor: color }]} />
        </>
      ) : (
        <View style={s.hangup} />
      )}
      {off && <View style={s.slash} />}
    </View>
  );
}
export function CallControls({
  muted,
  camera,
  cameraPending,
  cameraAvailable,
  connected,
  ending,
  onMute,
  onCamera,
  onAudio,
  onEnd,
}: {
  muted: boolean;
  camera: boolean;
  cameraPending: boolean;
  cameraAvailable: boolean;
  connected: boolean;
  ending: boolean;
  onMute: () => void;
  onCamera: () => void;
  onAudio: () => void;
  onEnd: () => void;
}) {
  const controls = [
    {
      id: "mic" as const,
      label: muted ? "Unmute" : "Mute",
      a11y: muted ? "Unmute microphone" : "Mute microphone",
      onPress: onMute,
      disabled: !connected,
      off: muted,
      active: muted,
    },
    {
      id: "camera" as const,
      label: cameraPending ? "Opening…" : "Camera",
      a11y: camera ? "Turn camera preview off" : "Turn camera preview on",
      onPress: onCamera,
      disabled: cameraPending || ending || !cameraAvailable,
      off: !camera,
      active: camera,
    },
    {
      id: "audio" as const,
      label: "Audio",
      a11y: "Choose audio output",
      onPress: onAudio,
      disabled: !connected,
    },
    {
      id: "end" as const,
      label: ending ? "Ending…" : "End",
      a11y: "End call",
      onPress: onEnd,
      disabled: ending,
    },
  ];
  return (
    <View style={s.bar}>
      {controls.map((c) => (
        <View key={c.id} style={s.item}>
          <Pressable
            testID={`call-${c.id}`}
            accessibilityRole="button"
            accessibilityLabel={c.a11y}
            accessibilityState={{ disabled: c.disabled, selected: !!c.active }}
            disabled={c.disabled}
            onPress={c.onPress}
            style={({ pressed }) => [
              s.button,
              c.active && s.active,
              c.id === "end" && s.end,
              c.disabled && s.disabled,
              pressed && s.pressed,
            ]}
          >
            <Icon name={c.id} off={c.off} />
          </Pressable>
          <Text style={s.label}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 12,
    padding: 14,
    borderRadius: 34,
    backgroundColor: "#152b3eea",
    borderWidth: 1,
    borderColor: "#ffffff17",
    boxShadow: "0 8px 30px #00000033",
  },
  item: { alignItems: "center", gap: 6, flex: 1 },
  button: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#ffffff12",
    alignItems: "center",
    justifyContent: "center",
  },
  active: { backgroundColor: "#166a61" },
  end: { backgroundColor: "#bc4960" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.96 }] },
  label: { fontSize: 11, color: "#c8d8e2" },
  icon: {
    width: 25,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  mic: { width: 9, height: 16, borderWidth: 1.8, borderRadius: 6, top: -3 },
  micStand: {
    width: 17,
    height: 14,
    borderWidth: 1.6,
    borderTopWidth: 0,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
    position: "absolute",
    top: 7,
  },
  camera: { width: 18, height: 14, borderWidth: 1.7, borderRadius: 4 },
  lens: {
    position: "absolute",
    right: 0,
    width: 5,
    height: 10,
    borderWidth: 1.5,
    borderRadius: 2,
  },
  headset: {
    width: 21,
    height: 20,
    borderWidth: 1.8,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  ear: { position: "absolute", width: 4, height: 10, top: 12, borderRadius: 2 },
  hangup: {
    width: 24,
    height: 12,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderColor: "#fff",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    transform: [{ rotate: "0deg" }],
  },
  slash: {
    position: "absolute",
    width: 2,
    height: 29,
    backgroundColor: "#fff",
    transform: [{ rotate: "-42deg" }],
  },
});

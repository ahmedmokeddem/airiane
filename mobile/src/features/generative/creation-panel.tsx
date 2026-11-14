import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Button, Surface, s } from "../product/product-ui";
import { theme as t } from "../../theme";
import { formats, type GenerationRequest } from "./types";
export function CreationPanel({
  busy,
  error,
  onGenerate,
  onClose,
  onRevoke,
}: {
  busy: boolean;
  error: string;
  onGenerate: (input: GenerationRequest) => void;
  onClose: () => void;
  onRevoke: () => void;
}) {
  const [goal, setGoal] = useState("");
  const [format, setFormat] =
    useState<GenerationRequest["format"]>("creative_activity");
  const [duration, setDuration] = useState(180);
  return (
    <Surface>
      <Text style={s.title}>Let’s invent something together</Text>
      <Text style={s.subtitle}>
        What would feel good right now? A brief everyday goal is enough.
      </Text>
      <TextInput
        testID="generated-activity-goal"
        accessibilityLabel="Your activity goal"
        placeholder="Something playful for a few minutes"
        value={goal}
        onChangeText={setGoal}
        maxLength={240}
        style={{
          borderWidth: 1,
          borderColor: t.accent,
          borderRadius: 16,
          padding: 14,
          color: t.ink,
          minHeight: 52,
        }}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {formats.map((f) => (
          <Button
            key={f.id}
            label={f.label}
            secondary={format !== f.id}
            onPress={() => setFormat(f.id)}
            disabled={busy}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[60, 180, 300].map((n) => (
          <Button
            key={n}
            label={`${n / 60} min`}
            secondary={n !== duration}
            onPress={() => setDuration(n)}
            disabled={busy}
          />
        ))}
      </View>
      <Text style={s.small}>
        For this conversation, allow up to three creations from goals you
        request. Only the brief goal, style and time go to Featherless AI. Avoid
        names, contact details or medical history. Your private notes and
        conversation are not sent. You can review the proposal before starting.
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={s.small}>
          {error}
        </Text>
      )}
      <Button
        label={busy ? "Creating your moment…" : "Allow & create this activity"}
        disabled={busy || goal.trim().length < 3}
        onPress={() =>
          onGenerate({ goal: goal.trim(), format, duration_seconds: duration })
        }
      />
      <Button
        secondary
        label="Turn off creation permission"
        onPress={onRevoke}
      />
      <Button
        secondary
        label={busy ? "Cancel creation" : "Keep familiar activities"}
        onPress={onClose}
      />
    </Surface>
  );
}

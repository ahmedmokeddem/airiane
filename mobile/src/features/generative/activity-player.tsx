import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Svg, { Circle, Rect, Polygon } from "react-native-svg";
import { Button, Surface, s } from "../product/product-ui";
import { Companion } from "../call/companion";
import { theme as t } from "../../theme";
import {
  palette,
  shapes,
  type Component,
  type Definition,
  type Progress,
  type Transition,
} from "./types";

type InteractionProps = {
  step: Component;
  disabled: boolean;
  submit: (extra?: Partial<Transition>) => void;
};
function Pattern({ step, disabled, submit }: InteractionProps) {
  const [answer, setAnswer] = useState<string[]>([]);
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.subtitle}>{step.sequence?.join(" → ")}</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {shapes.map((shape) => (
          <Button
            label={shape}
            key={shape}
            disabled={disabled || answer.length >= (step.sequence?.length ?? 0)}
            onPress={() => setAnswer((a) => [...a, shape])}
          />
        ))}
      </View>
      <Text style={s.small}>
        Your pattern: {answer.join(" → ") || "Choose the shapes above"}
      </Text>
      <Button
        label="Try my pattern"
        disabled={disabled || answer.length !== step.sequence?.length}
        onPress={() => submit({ sequence: answer as Transition["sequence"] })}
      />
      <Button
        secondary
        label="Clear pattern"
        disabled={disabled}
        onPress={() => setAnswer([])}
      />
    </View>
  );
}
function Canvas({ disabled, submit }: InteractionProps) {
  const [color, setColor] = useState<string>(palette[0]);
  const [tiles, setTiles] = useState<string[]>(Array(9).fill("transparent"));
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.small}>
        Choose a color, then touch a tile. There is no right result. Your
        creation stays on this screen.
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {palette.map((c) => (
          <Pressable
            testID={`generated-color-${c.slice(1)}`}
            key={c}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${{ "#37877E": "teal", "#B8A3CE": "lavender", "#E3BB79": "honey", "#597694": "blue" }[c]}`}
            accessibilityState={{ selected: c === color }}
            onPress={() => setColor(c)}
            style={{
              width: 48,
              height: 48,
              backgroundColor: c,
              borderRadius: 24,
              borderWidth: c === color ? 3 : 0,
              borderColor: t.ink,
            }}
          />
        ))}
      </View>
      <View
        style={{
          alignSelf: "center",
          width: 210,
          flexDirection: "row",
          flexWrap: "wrap",
        }}
      >
        {tiles.map((c, i) => (
          <Pressable
            testID={`generated-tile-${i}`}
            key={i}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Paint tile ${i + 1}`}
            onPress={() =>
              setTiles((a) => a.map((v, j) => (j === i ? color : v)))
            }
            style={{ width: 70, height: 70, padding: 4 }}
          >
            <Svg viewBox="0 0 60 60" width="100%" height="100%">
              {i % 3 === 0 ? (
                <Circle cx="30" cy="30" r="25" fill={c} stroke={t.accent} />
              ) : i % 3 === 1 ? (
                <Rect
                  x="5"
                  y="5"
                  width="50"
                  height="50"
                  rx="10"
                  fill={c}
                  stroke={t.accent}
                />
              ) : (
                <Polygon points="30,4 57,55 3,55" fill={c} stroke={t.accent} />
              )}
            </Svg>
          </Pressable>
        ))}
      </View>
      <Button
        label="Keep this moment"
        disabled={disabled}
        onPress={() => submit()}
      />
    </View>
  );
}
function Reflection({ step, disabled, submit }: InteractionProps) {
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState<{ text: string; category: number }[]>([]);
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.small}>
        Optional private notes — kept only on this screen, never sent or saved.
        Tap a note to move it between groups.
      </Text>
      <TextInput
        testID="generated-private-thought"
        accessibilityLabel="Private thought"
        editable={!disabled}
        value={draft}
        maxLength={140}
        onChangeText={setDraft}
        placeholder="A thought, or leave blank"
        style={{
          padding: 12,
          borderWidth: 1,
          borderColor: t.accent,
          borderRadius: 12,
          color: t.ink,
        }}
      />
      <Button
        secondary
        label="Add private note"
        disabled={disabled || !draft.trim() || notes.length >= 6}
        onPress={() => {
          setNotes((a) => [...a, { text: draft, category: 0 }]);
          setDraft("");
        }}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {step.categories?.map((name, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 14,
              backgroundColor: t.low,
            }}
          >
            <Text style={s.small}>{name}</Text>
            {notes.map((note, i) =>
              note.category === index ? (
                <Pressable
                  testID={`generated-tile-${i}`}
                  key={i}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={`Move note ${i + 1} to next group`}
                  onPress={() =>
                    setNotes((a) =>
                      a.map((n, j) =>
                        j === i
                          ? {
                              ...n,
                              category:
                                (n.category + 1) %
                                (step.categories?.length ?? 2),
                            }
                          : n,
                      ),
                    )
                  }
                  style={{ padding: 10, minHeight: 48 }}
                >
                  <Text style={s.subtitle}>{note.text}</Text>
                </Pressable>
              ) : null,
            )}
          </View>
        ))}
      </View>
      <Button
        label="Continue without saving notes"
        disabled={disabled}
        onPress={() => submit()}
      />
    </View>
  );
}
function Focus({ disabled, submit }: InteractionProps) {
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <Companion state="idle" size={110} levelRef={{ current: 0 }} />
      <Text style={s.small}>
        Follow your own comfortable rhythm. No need to change or hold your
        breath.
      </Text>
      <Button
        label="Continue when ready"
        disabled={disabled}
        onPress={() => submit()}
      />
    </View>
  );
}
function Practical({ disabled, submit }: InteractionProps) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.small}>
        Only you can confirm what you did. You can skip this step instead.
      </Text>
      <Button
        label="I’ve done this step"
        disabled={disabled}
        onPress={() => submit()}
      />
    </View>
  );
}
function Choice({ step, disabled, submit }: InteractionProps) {
  return (
    <View style={{ gap: 8 }}>
      {step.choices?.map((c) => (
        <Button
          key={c.id}
          label={c.label}
          disabled={disabled}
          onPress={() => submit({ choice_id: c.id })}
        />
      ))}
    </View>
  );
}
const registry = {
  visual_pattern: Pattern,
  creative_canvas: Canvas,
  thought_sort: Reflection,
  guided_focus: Focus,
  practical_step: Practical,
  choice: Choice,
};
export function GeneratedPlayer({
  definition,
  progress,
  busy,
  error,
  onChange,
  onLeave,
  onComplete,
  rating,
  onRating,
}: {
  definition: Definition;
  progress: Progress;
  busy: boolean;
  error: string;
  onChange: (action: Transition["action"], extra?: Partial<Transition>) => void;
  onLeave: () => void;
  onComplete: () => void;
  rating: number;
  onRating: (n: number) => void;
}) {
  const step = progress.current;
  const Component = step ? registry[step.type] : null;
  return (
    <Surface>
      <Text style={s.eyebrow}>
        CREATED TOGETHER ·{" "}
        {Math.min(progress.step + 1, definition.components.length)} /{" "}
        {definition.components.length}
      </Text>
      <Text style={s.title}>{definition.title}</Text>
      <Text style={s.small}>{definition.purpose}</Text>
      {!!error && (
        <Text accessibilityRole="alert" style={s.small}>
          {error}
        </Text>
      )}
      {step && (
        <Text accessibilityLiveRegion="polite" style={s.subtitle}>
          {step.prompt}
        </Text>
      )}
      {step && Component && (
        <View
          pointerEvents={progress.paused ? "none" : "auto"}
          accessibilityElementsHidden={progress.paused}
          importantForAccessibility={
            progress.paused ? "no-hide-descendants" : "auto"
          }
          style={{ opacity: progress.paused ? 0.45 : 1 }}
        >
          <Component
            key={`${progress.activity_session_id}:${step.id}`}
            step={step}
            disabled={busy || progress.paused}
            submit={(extra) => onChange("next", extra)}
          />
        </View>
      )}
      {progress.paused && (
        <Text style={s.subtitle}>Take your time. Your place is kept.</Text>
      )}
      {progress.finished ? (
        <>
          <Text style={s.subtitle}>
            How useful or enjoyable was this moment?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                label={`${n} ★`}
                secondary={rating !== n}
                onPress={() => onRating(n)}
              />
            ))}
          </View>
          <Button
            label="Confirm, complete & save"
            disabled={busy}
            onPress={onComplete}
          />
        </>
      ) : (
        <>
          <Button
            secondary
            label={progress.paused ? "Resume" : "Pause"}
            disabled={busy}
            onPress={() => onChange(progress.paused ? "resume" : "pause")}
          />
          <Button
            secondary
            label="Skip this step"
            disabled={busy || progress.paused}
            onPress={() => onChange("skip")}
          />
        </>
      )}
      <Button
        secondary
        label="Stop activity"
        disabled={busy}
        onPress={onLeave}
      />
    </Surface>
  );
}

import type { AgentEvent } from "../../integration/voice-agent-adapter";
export type CompanionState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "disconnected";
export function nextCompanionState(
  current: CompanionState,
  event: AgentEvent,
): CompanionState {
  // SDK mode/transcript callbacks can arrive after disconnection. They must not
  // make a closed call appear to be listening or hide its reconnect control.
  if (current === "disconnected" && !["connecting", "connected", "disconnected", "error"].includes(event.type))
    return current;
  switch (event.type) {
    case "connected":
      return "listening";
    case "disconnected":
    case "error":
      return "disconnected";
    case "connecting":
      return "connecting";
    case "interrupted":
      return "interrupted";
    case "mode":
      return event.mode ?? current;
    case "thinking":
      return "thinking";
    case "message_final":
      return event.role === "user" ? "thinking" : current;
    default:
      return current;
  }
}
export const stateLabels: Record<CompanionState, string> = {
  idle: "A little space for you",
  connecting: "Connecting with AIriane…",
  listening: "Listening with presence",
  thinking: "Taking a moment…",
  speaking: "AIriane is speaking",
  interrupted: "Take your time",
  disconnected: "Call ended",
};
export const routeNames: Record<string, string> = {
  bluetooth: "Bluetooth headset",
  headset: "Wired headphones",
  earpiece: "Phone earpiece",
  speaker: "Speakerphone",
  default: "System audio",
  force_speaker: "Speakerphone",
};
export function preferredRoute(outputs: string[]) {
  return ["bluetooth", "headset", "speaker", "earpiece", "default"].find(
    (value) => outputs.includes(value),
  );
}

import type { Bootstrap } from "./types";
export type AgentEvent = {
  type:
    | "connected"
    | "disconnected"
    | "error"
    | "message_final"
    | "connecting"
    | "mode"
    | "thinking"
    | "interrupted"
    | "audio_level";
  text?: string;
  role?: "user" | "agent";
  mode?: "listening" | "speaking";
  level?: number;
};
export interface VoiceAgentAdapter {
  connect(bootstrap: Bootstrap): Promise<void>;
  disconnect(): Promise<void>;
  sendText(text: string): void;
  updateContext(context: string): void;
  setMicrophoneMuted(muted: boolean): void;
  setPlaybackVolume(volume: number): void;
  subscribe(listener: (event: AgentEvent) => void): () => void;
}
// Deliberately no camera, image, video, track or preview input.
export interface ElevenSdkPort {
  startSession(options: Record<string, unknown>): Promise<unknown> | void;
  endSession(): Promise<unknown> | void;
  sendUserMessage(text: string): void;
  sendContextualUpdate(text: string): void;
  setVolume(options: { volume: number }): void;
}
export class ElevenLabsAdapter implements VoiceAgentAdapter {
  private connected = false;
  private mode: Bootstrap["mode"] | null = null;
  private listeners = new Set<(event: AgentEvent) => void>();
  constructor(
    private sdk: ElevenSdkPort,
    private mute: (muted: boolean) => void,
  ) {}
  async connect(b: Bootstrap) {
    if (
      b.provider !== "elevenlabs" ||
      b.camera_policy !== "local_preview_only_no_transmission"
    )
      throw new Error("Unsupported provider policy");
    this.mode = b.mode;
    this.emit({ type: "connecting" });
    const ready = this.wait("connected");
    try {
      Promise.resolve(
        this.sdk.startSession(
          b.mode === "voice"
            ? {
                conversationToken: b.conversation_token,
                connectionType: "webrtc",
              }
            : {
                signedUrl: b.signed_url,
                textOnly: true,
                connectionType: "websocket",
              },
        ),
      ).catch((error) =>
        this.emit({
          type: "error",
          text:
            error instanceof Error ? error.message : "Voice connection failed",
        }),
      );
    } catch (error) {
      this.emit({
        type: "error",
        text:
          error instanceof Error ? error.message : "Voice connection failed",
      });
    }
    await ready;
    this.sdk.sendContextualUpdate(JSON.stringify({...b.agent_context,application_time:new Date().toISOString()}));
  }
  async disconnect() {
    if (!this.mode) return;
    if (!this.connected) {
      this.sdk.endSession();
      this.emit({ type: "disconnected" });
      return;
    }
    const stopped = this.wait("disconnected");
    this.sdk.endSession();
    await stopped;
  }
  sendText(text: string) {
    this.sdk.sendUserMessage(text);
  }
  updateContext(text: string) {
    if (this.connected) this.sdk.sendContextualUpdate(text);
  }
  setMicrophoneMuted(value: boolean) {
    if (this.connected && this.mode === "voice") this.mute(value);
  }
  setPlaybackVolume(value: number) {
    if (this.connected && this.mode === "voice")
      this.sdk.setVolume({ volume: value });
  }
  subscribe(listener: (event: AgentEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private wait(type: AgentEvent["type"]) {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        off();
        reject(new Error("Provider connection timed out"));
      }, 20000);
      const off = this.subscribe((event) => {
        if (event.type === type) {
          clearTimeout(timeout);
          off();
          resolve();
        }
        if (
          event.type === "error" ||
          (type === "connected" && event.type === "disconnected")
        ) {
          clearTimeout(timeout);
          off();
          reject(new Error(event.text ?? "Call interrupted before connecting"));
        }
      });
    });
  }
  emit(event: AgentEvent) {
    if (event.type === "connected") this.connected = true;
    if (event.type === "disconnected") {
      this.connected = false;
      this.mode = null;
    }
    this.listeners.forEach((listener) => listener(event));
  }
}

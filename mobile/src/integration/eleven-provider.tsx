import {
  ConversationProvider,
  useConversation,
} from "@elevenlabs/react-native";
import { TextConversation } from "@elevenlabs/client";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  ElevenLabsAdapter,
  type VoiceAgentAdapter,
} from "./voice-agent-adapter";
export type ClientTools = Record<
  string,
  (args: Record<string, unknown>) => Promise<string>
>;
export function ElevenProvider({
  children,
  tools,
  onAdapter,
  onMessage,
  onDisconnected,
}: {
  children: ReactNode;
  tools: ClientTools;
  onAdapter: (adapter: VoiceAgentAdapter) => void;
  onMessage: (role: string, text: string) => void;
  onDisconnected: () => void;
}) {
  const active = useRef<ElevenLabsAdapter | null>(null);
  const bind = useCallback(
    (a: ElevenLabsAdapter) => {
      active.current = a;
      onAdapter(a);
    },
    [onAdapter],
  );
  return (
    <ConversationProvider
      clientTools={tools}
      onModeChange={({ mode }) => active.current?.emit({ type: "mode", mode })}
      onInterruption={() => active.current?.emit({ type: "interrupted" })}
      onAgentToolRequest={() => active.current?.emit({ type: "thinking" })}
      onConnect={() => active.current?.emit({ type: "connected" })}
      onError={(message) =>
        active.current?.emit({ type: "error", text: message })
      }
      onMessage={(message) => {
        active.current?.emit({
          type: "message_final",
          text: message.message,
          role: message.source === "user" ? "user" : "agent",
        });
        onMessage(message.source, message.message);
      }}
      onDisconnect={() => {
        active.current?.emit({ type: "disconnected" });
        onDisconnected();
      }}
    >
      <Binding
        onAdapter={bind}
        active={active}
        tools={tools}
        onMessage={onMessage}
        onDisconnected={onDisconnected}
      />
      {children}
    </ConversationProvider>
  );
}
function Binding({
  onAdapter,
  active,
  tools,
  onMessage,
  onDisconnected,
}: {
  onAdapter: (a: ElevenLabsAdapter) => void;
  active: { current: ElevenLabsAdapter | null };
  tools: ClientTools;
  onMessage: (role: string, text: string) => void;
  onDisconnected: () => void;
}) {
  const textSession = useRef<TextConversation | null>(null);
  const callbacks = useRef({ tools, onMessage, onDisconnected });
  useEffect(() => {
    callbacks.current = { tools, onMessage, onDisconnected };
  }, [tools, onMessage, onDisconnected]);
  const sdk = useConversation();
  const sdkRef = useRef(sdk);
  useEffect(() => {
    sdkRef.current = sdk;
  }, [sdk]);
  useEffect(() => {
    if (sdk.status !== "connected") return;
    const timer = setInterval(() => {
      try {
        const level = sdkRef.current.isSpeaking
          ? sdkRef.current.getOutputVolume()
          : sdkRef.current.getInputVolume();
        active.current?.emit({
          type: "audio_level",
          level: Number.isFinite(level) ? level : 0,
        });
      } catch {
        /* Metering is optional, never break a call. */
      }
    }, 100);
    return () => clearInterval(timer);
  }, [sdk.status, active]);
  const adapterRef = useRef<ElevenLabsAdapter | null>(null);
  useEffect(() => {
    if (adapterRef.current == null)
      adapterRef.current = new ElevenLabsAdapter(
        {
          startSession: (o) => {
            if (o.textOnly) {
              return TextConversation.startSession({
                ...o,
                signedUrl: String(o.signedUrl),
                textOnly: true,
                connectionType: "websocket",
                clientTools: callbacks.current.tools,
                onConversationCreated: (conversation) => {
                  textSession.current = conversation as TextConversation;
                },
                onConnect: () => active.current?.emit({ type: "connected" }),
                onDisconnect: () => {
                  textSession.current = null;
                  active.current?.emit({ type: "disconnected" });
                  callbacks.current.onDisconnected();
                },
                onError: (message) =>
                  active.current?.emit({ type: "error", text: message }),
                onMessage: (message) => {
                  active.current?.emit({
                    type: "message_final",
                    text: message.message,
                    role: message.source === "user" ? "user" : "agent",
                  });
                  callbacks.current.onMessage(message.source, message.message);
                },
              });
            }
            return sdkRef.current.startSession(o);
          },
          endSession: () =>
            textSession.current
              ? textSession.current.endSession()
              : sdkRef.current.endSession(),
          sendUserMessage: (t) =>
            textSession.current
              ? textSession.current.sendUserMessage(t)
              : sdkRef.current.sendUserMessage(t),
          sendContextualUpdate: (t) =>
            textSession.current
              ? textSession.current.sendContextualUpdate(t)
              : sdkRef.current.sendContextualUpdate(t),
          setVolume: (o) => sdkRef.current.setVolume(o),
        },
        (value) => sdkRef.current.setMuted(value),
      );
    onAdapter(adapterRef.current);
  }, [onAdapter, active]);
  return null;
}

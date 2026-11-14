export type ProductTab = "home" | "text" | "activities" | "journey";
export const destinations = [
  { key: "home", label: "Home", icon: "home", path: "/" },
  { key: "text", label: "Companion", icon: "message-circle", path: "/text" },
  { key: "activities", label: "Activities", icon: "wind", path: "/activities" },
  { key: "journey", label: "Journey", icon: "star", path: "/journey" },
] as const;
export function selectedTab(path: string): ProductTab | null {
  return destinations.find((d) => d.path === path)?.key ?? null;
}
export function isImmersive(path: string, voiceCall: boolean) {
  return path === "/voice" || (path === "/breathing" && voiceCall);
}

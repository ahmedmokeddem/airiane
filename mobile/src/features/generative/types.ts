import type { DTO } from "../../integration/types";
export type Definition = DTO<"GeneratedActivityDefinition">;
export type Component = Definition["components"][number];
export type Progress = DTO<"GeneratedProgress">;
export type Transition = DTO<"GeneratedTransition">;
export type GenerationRequest = DTO<"GenerationRequest">;
export type Job = DTO<"GenerationJob">;
export const formats: { id: GenerationRequest["format"]; label: string }[] = [
  { id: "mini_game", label: "Play" },
  { id: "creative_activity", label: "Create" },
  { id: "guided_experience", label: "Unwind" },
  { id: "interactive_reflection", label: "Reflect" },
  { id: "practical_activity", label: "Small steps" },
];
export const shapes = ["circle", "square", "triangle"] as const;
export const palette = ["#37877E", "#B8A3CE", "#E3BB79", "#597694"] as const;
/** Unknown or stale state never advances optimistically. */
export function actionFor(
  progress: Progress,
  action: Transition["action"],
  extra: Partial<Transition> = {},
): Transition {
  return {
    ...extra,
    choice_id: extra.choice_id ?? null,
    expected_revision: progress.revision,
    step_id: progress.current?.id ?? "completion",
    action,
  };
}

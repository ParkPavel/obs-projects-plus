import type { TransformStopReason } from "src/lib/dashboard-engine/transformTypes";
import type { NamedSourceNotice } from "./DatabaseCall/namedSourceNotice";

export function pipelineStopNotice(reason: TransformStopReason | undefined, translate: (key: string) => string): NamedSourceNotice | null {
  if (!reason) return null;
  const key = "views.dashboard.pipeline.execution-stopped";
  return { placement: "screen", icon: "alert-triangle", key, fallback: translate(key), vars: {},
    hint: translate(`views.dashboard.pipeline.execution.${reason}`) };
}

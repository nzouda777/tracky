import type { AutoAdvanceSettings, Stage } from "@/lib/db";
import { estimateArrivalHours } from "./phases";

/**
 * When auto-advance brings an order to each stage, as a plain object that can
 * be handed to a client component. Null when auto-advance is off.
 */
export function arrivalHoursFor(
  stages: Stage[],
  settings: AutoAdvanceSettings | null,
): Record<string, number> | null {
  if (!settings?.enabled) return null;
  return Object.fromEntries(estimateArrivalHours(stages, settings));
}

import { IconAlertOctagon, IconAlertTriangle, IconCheckCircle } from "@/components/icons";

/**
 * Store health at a glance.
 *
 * Colour is paired with an icon and a word, never used alone — two of the
 * status colours fall below 3:1 on a white surface by design.
 */
const HEALTH = {
  healthy: { label: "Healthy", icon: IconCheckCircle, color: "var(--viz-good)" },
  attention: { label: "Attention", icon: IconAlertTriangle, color: "var(--viz-serious)" },
  broken: { label: "Broken", icon: IconAlertOctagon, color: "var(--viz-critical)" },
} as const;

export function HealthBadge({
  health,
  reason,
}: {
  health: keyof typeof HEALTH;
  reason?: string;
}) {
  const entry = HEALTH[health];
  const Icon = entry.icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-800"
      title={reason}
    >
      <span style={{ color: entry.color }}>
        <Icon className="size-3.5" />
      </span>
      {entry.label}
    </span>
  );
}

"use client";

import { EMAIL_DESIGNS, type EmailDesignId } from "@/lib/email/designs/catalog";
import { cn } from "@/lib/utils";
import { DesignSwatches } from "./design-swatches";

/**
 * Radio cards for choosing a template's design. Posts as `design`, so it drops
 * into any template form; controlled when the caller needs to react (the
 * editor re-renders its preview), uncontrolled otherwise.
 */
export function DesignPicker({
  value,
  defaultValue,
  onChange,
  name = "design",
}: {
  value?: EmailDesignId;
  defaultValue?: EmailDesignId;
  onChange?: (design: EmailDesignId) => void;
  name?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Email design"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {EMAIL_DESIGNS.map((design) => {
        const checked = value !== undefined ? value === design.id : undefined;
        return (
          <label
            key={design.id}
            className={cn(
              "group relative flex cursor-pointer flex-col gap-2 rounded-control border border-line bg-white p-3 transition-colors",
              "hover:border-ink-400 has-[:checked]:border-ink-900 has-[:checked]:ring-1 has-[:checked]:ring-ink-900",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-dispatch",
            )}
          >
            <input
              type="radio"
              name={name}
              value={design.id}
              className="sr-only"
              {...(checked !== undefined
                ? { checked, onChange: () => onChange?.(design.id) }
                : {
                    defaultChecked: defaultValue === design.id,
                    onChange: () => onChange?.(design.id),
                  })}
            />
            <DesignSwatches colors={design.swatches} />
            <span>
              <span className="block text-sm font-semibold text-ink-900">
                {design.name}
              </span>
              <span className="block text-xs text-ink-500">{design.tagline}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

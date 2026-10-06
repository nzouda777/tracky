"use client";

import { Checkbox, Field, Input } from "@/components/ui";
import {
  HOOMA_THEMES,
  HOOMA_THEME_IDS,
  type HoomaOptions,
  type HoomaThemeId,
} from "@/lib/email/designs/hooma-options";
import { cn } from "@/lib/utils";

const ICON_PRESETS = ["✓", "📦", "🚚", "🛠️", "🏠", "📋", "⏳", "🎉", "⚠️"];

/**
 * The Hooma design's own settings. Controlled, so the preview follows every
 * keystroke; each control also carries a `hooma.*` name so the surrounding
 * form saves it.
 */
export function HoomaFields({
  value,
  onChange,
}: {
  value: HoomaOptions;
  onChange: (next: HoomaOptions) => void;
}) {
  const set = <K extends keyof HoomaOptions>(key: K, next: HoomaOptions[K]) =>
    onChange({ ...value, [key]: next });

  const text = (
    key:
      | "heroTitle"
      | "heroSubtitle"
      | "nextUpdate"
      | "greeting"
      | "buttonLabel"
      | "footerNote",
    label: string,
    hint?: string,
  ) => (
    <Field label={label} htmlFor={`hooma-${key}`} hint={hint}>
      <Input
        id={`hooma-${key}`}
        name={`hooma.${key}`}
        value={value[key]}
        onChange={(event) => set(key, event.currentTarget.value)}
      />
    </Field>
  );

  return (
    <fieldset className="space-y-4 rounded-lg border border-ink-200 p-4">
      <legend className="px-1 text-sm font-semibold text-ink-900">
        Hooma settings
      </legend>

      <Field label="Colour">
        <input type="hidden" name="hooma.theme" value={value.theme} />
        <div className="flex flex-wrap gap-2">
          {HOOMA_THEME_IDS.map((id) => (
            <ThemeChip
              key={id}
              id={id}
              selected={value.theme === id}
              onSelect={() => set("theme", id)}
            />
          ))}
        </div>
      </Field>

      <Field
        label="Icon"
        htmlFor="hooma-icon"
        hint="Any emoji or character. ✓ is drawn as a white tick. Leave empty for no circle."
      >
        <div className="space-y-2">
          <Input
            id="hooma-icon"
            name="hooma.icon"
            value={value.icon}
            onChange={(event) => set("icon", event.currentTarget.value)}
            className="max-w-28"
          />
          <div className="flex flex-wrap gap-1.5">
            {ICON_PRESETS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => set("icon", icon)}
                aria-pressed={value.icon === icon}
                className={cn(
                  "grid size-9 place-items-center rounded-md border text-lg transition",
                  value.icon === icon
                    ? "border-ink-900 bg-ink-50"
                    : "border-ink-200 hover:border-ink-400",
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </Field>

      {text("heroTitle", "Headline")}
      {text("heroSubtitle", "Line under the headline")}
      {text(
        "nextUpdate",
        "Next update note",
        "Shown with a 🕐 under the header. Leave empty to hide it.",
      )}
      {text("greeting", "Greeting", "Bold line above the body, e.g. Hi {{customer_first_name}},")}
      {text("buttonLabel", "Button label", "Opens the tracking page. Leave empty to hide the button.")}
      {text("footerNote", "Note above the footer", "Leave empty to hide it.")}

      <div className="space-y-3 border-t border-ink-100 pt-4">
        <Toggle
          name="showOrderCard"
          label="Order card (number, total, date)"
          value={value}
          set={set}
        />
        <Toggle
          name="orderCardFirst"
          label="Put the order card right under the header"
          value={value}
          set={set}
        />
        <Toggle name="showTotal" label="Show the total in the order card" value={value} set={set} />
        <Toggle name="showItems" label="Items list" value={value} set={set} />
        <Toggle name="showAddress" label="Delivery address" value={value} set={set} />
      </div>

      <p className="text-xs text-ink-500">
        Every text accepts merge variables, e.g. {"{{order_number}}"} or{" "}
        {"{{customer_first_name}}"}.
      </p>
    </fieldset>
  );
}

function Toggle({
  name,
  label,
  value,
  set,
}: {
  name: "showOrderCard" | "orderCardFirst" | "showTotal" | "showItems" | "showAddress";
  label: string;
  value: HoomaOptions;
  set: <K extends keyof HoomaOptions>(key: K, next: HoomaOptions[K]) => void;
}) {
  return (
    <Checkbox
      id={`hooma-${name}`}
      name={`hooma.${name}`}
      label={label}
      checked={value[name]}
      onChange={(event) => set(name, event.currentTarget.checked)}
    />
  );
}

function ThemeChip({
  id,
  selected,
  onSelect,
}: {
  id: HoomaThemeId;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = id === "brand" ? null : HOOMA_THEMES[id];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        selected
          ? "border-ink-900 bg-ink-50 text-ink-900"
          : "border-ink-200 text-ink-600 hover:border-ink-400",
      )}
    >
      <span
        aria-hidden
        className="size-3.5 rounded-full"
        style={
          theme
            ? { background: `linear-gradient(135deg, ${theme.heroTo}, ${theme.solid})` }
            : { background: "conic-gradient(#f43f5e, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #f43f5e)" }
        }
      />
      {theme ? theme.name : "Brand colour"}
    </button>
  );
}

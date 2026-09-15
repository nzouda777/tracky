"use client";

import { upload } from "@vercel/blob/client";
import { useActionState, useMemo, useRef, useState } from "react";

import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Branding } from "@/components/tracking/branding";
import { buildSampleView } from "@/components/tracking/sample-view";
import { TrackingPage } from "@/components/tracking/tracking-page";
import { updateBrandingAction } from "@/lib/actions/branding";
import { ResetBrandingForm } from "./reset-branding-form";
import type { ActionResult } from "@/lib/actions/result";
import type { Stage } from "@/lib/db";
import { cn } from "@/lib/utils";

/**
 * Archivo is the default because it is the face the rest of the product is
 * set in — a signage grotesque, which is the right register for a delivery
 * page. The rest are system stacks, which need no download and therefore
 * cannot make a customer wait on a slow connection.
 */
const FONT_STACKS = [
  {
    label: "Archivo (default)",
    value: "var(--font-archivo), ui-sans-serif, system-ui, sans-serif",
  },
  {
    label: "System sans",
    value:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  { label: "Georgia serif", value: "Georgia, 'Times New Roman', serif" },
  {
    label: "Helvetica / Arial",
    value: "Helvetica Neue, Helvetica, Arial, sans-serif",
  },
];

/**
 * Ready-made colour sets, so a store looks deliberate without picking hexes.
 *
 * Every one keeps the secondary colour in hi-vis territory, because that is
 * the one the page spends on the active waypoint and nothing else. A muted
 * grey there would leave the route line with nothing marking where the order
 * actually is.
 */
const PRESETS = [
  {
    name: "Dispatch",
    primaryColor: "#1B2B44",
    accentColor: "#1B2B44",
    backgroundColor: "#FFFFFF",
    textColor: "#131A24",
    secondaryColor: "#F5A524",
  },
  {
    name: "Slate",
    primaryColor: "#2F3A45",
    accentColor: "#2F3A45",
    backgroundColor: "#FFFFFF",
    textColor: "#14181C",
    secondaryColor: "#F5A524",
  },
  {
    name: "Forest",
    primaryColor: "#18493A",
    accentColor: "#18493A",
    backgroundColor: "#FFFFFF",
    textColor: "#10231C",
    secondaryColor: "#E0A32E",
  },
  {
    name: "Night",
    primaryColor: "#E6E8E4",
    accentColor: "#9FB4D4",
    backgroundColor: "#131A24",
    textColor: "#E6E8E4",
    secondaryColor: "#F5A524",
  },
] as const;

type SectionId = "theme" | "identity" | "content" | "faq" | "layout";

const SECTIONS: Array<{ id: SectionId; label: string; summary: string }> = [
  { id: "theme", label: "Theme", summary: "Colours and typography" },
  { id: "identity", label: "Identity", summary: "Logo and store name" },
  { id: "content", label: "Page copy", summary: "Titles, help banner, footer" },
  { id: "faq", label: "FAQ", summary: "Questions shown under the timeline" },
  { id: "layout", label: "Sections", summary: "What appears on the page" },
];

/**
 * Branding editor.
 *
 * One long scroll of a dozen cards made this screen hard to work in, so the
 * settings are grouped into named sections with a tab rail, and the preview is
 * pinned beside them. The preview is the real `TrackingPage` component fed with
 * draft values, not a mock-up — what an owner approves is what a customer gets.
 *
 * All sections stay mounted in the DOM (hidden, not unmounted) for a reason:
 * this is one `<form>`, and an unmounted input submits nothing. Switching tabs
 * must never silently drop a field the owner edited.
 */
export function BrandingEditor({
  branding,
  stages,
  storeId,
  storeName,
  shopDomain,
}: {
  branding: Branding;
  stages: Stage[];
  storeId: string;
  storeName: string;
  shopDomain: string;
}) {
  const [draft, setDraft] = useState<Branding>(branding);
  const [faq, setFaq] = useState(branding.faq ?? []);
  const [section, setSection] = useState<SectionId>("theme");
  const [logoError, setLogoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const [state, formAction] = useActionState<ActionResult, FormData>(
    updateBrandingAction,
    {},
  );

  const sample = useMemo(() => buildSampleView(stages), [stages]);
  const previewBranding = useMemo<Branding>(
    () => ({ ...draft, faq }),
    [draft, faq],
  );

  function set<K extends keyof Branding>(key: K, value: Branding[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setDraft((current) => ({
      ...current,
      primaryColor: preset.primaryColor,
      accentColor: preset.accentColor,
      backgroundColor: preset.backgroundColor,
      textColor: preset.textColor,
      secondaryColor: preset.secondaryColor,
    }));
  }

  async function uploadLogo() {
    const file = logoRef.current?.files?.[0];
    if (!file) return;

    setLogoError(null);
    setUploading(true);
    try {
      const blob = await upload(
        `logos/${storeId}/${Date.now()}-${file.name}`,
        file,
        { access: "public", handleUploadUrl: "/api/blob/upload" },
      );
      set("logoUrl", blob.url);
    } catch (error) {
      setLogoError(
        error instanceof Error
          ? error.message
          : "The logo could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction}>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,30rem)_1fr]">
        {/* ------------------------- Editor ------------------------- */}
        <div className="space-y-4">
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
            {/* Section rail */}
            <div
              role="tablist"
              aria-label="Branding sections"
              className="flex gap-1 overflow-x-auto border-b border-ink-200 bg-ink-50 px-2 py-2"
            >
              {SECTIONS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={section === entry.id}
                  aria-controls={`branding-panel-${entry.id}`}
                  onClick={() => setSection(entry.id)}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    section === entry.id
                      ? "bg-white text-ink-900 shadow-sm ring-1 ring-ink-200"
                      : "text-ink-600 hover:bg-white/70 hover:text-ink-900",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="px-4 py-4 sm:px-5">
              <p className="mb-4 text-xs text-ink-500">
                {SECTIONS.find((entry) => entry.id === section)?.summary}
              </p>

              {/* Every panel stays mounted so nothing is dropped on submit. */}
              <Panel id="theme" current={section}>
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-sm font-medium text-ink-800">
                      Start from a preset
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="flex items-center gap-2 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
                        >
                          <span className="flex -space-x-1">
                            {[
                              preset.primaryColor,
                              preset.accentColor,
                              preset.backgroundColor,
                            ].map((colour) => (
                              <span
                                key={colour}
                                aria-hidden
                                className="size-3.5 rounded-full ring-1 ring-ink-200"
                                style={{ backgroundColor: colour }}
                              />
                            ))}
                          </span>
                          {preset.name}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-ink-400">
                      A preset only fills the colour fields — adjust anything
                      afterwards.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ColorField
                      label="Primary"
                      name="primaryColor"
                      value={draft.primaryColor}
                      onChange={(v) => set("primaryColor", v)}
                    />
                    <ColorField
                      label="Accent"
                      name="accentColor"
                      value={draft.accentColor}
                      onChange={(v) => set("accentColor", v)}
                    />
                    <ColorField
                      label="Background"
                      name="backgroundColor"
                      value={draft.backgroundColor}
                      onChange={(v) => set("backgroundColor", v)}
                    />
                    <ColorField
                      label="Text"
                      name="textColor"
                      value={draft.textColor}
                      onChange={(v) => set("textColor", v)}
                    />
                    <ColorField
                      label="Secondary"
                      name="secondaryColor"
                      value={draft.secondaryColor}
                      onChange={(v) => set("secondaryColor", v)}
                    />
                  </div>

                  <ContrastHint
                    background={draft.backgroundColor}
                    text={draft.textColor}
                  />

                  <div className="space-y-4 border-t border-ink-100 pt-4">
                    <Field label="Font" htmlFor="brand-font">
                      <Select
                        id="brand-font"
                        name="fontFamily"
                        value={draft.fontFamily}
                        onChange={(e) => set("fontFamily", e.currentTarget.value)}
                      >
                        {FONT_STACKS.map((font) => (
                          <option key={font.label} value={font.value}>
                            {font.label}
                          </option>
                        ))}
                        {FONT_STACKS.every(
                          (font) => font.value !== draft.fontFamily,
                        ) ? (
                          <option value={draft.fontFamily}>Custom</option>
                        ) : null}
                      </Select>
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Body text size (px)" htmlFor="brand-base-size">
                        <Input
                          id="brand-base-size"
                          name="baseFontSize"
                          type="number"
                          min={12}
                          max={22}
                          value={draft.baseFontSize}
                          onChange={(e) =>
                            set("baseFontSize", Number(e.currentTarget.value))
                          }
                        />
                      </Field>
                      <Field
                        label="Heading size (px)"
                        htmlFor="brand-heading-size"
                      >
                        <Input
                          id="brand-heading-size"
                          name="headingFontSize"
                          type="number"
                          min={16}
                          max={48}
                          value={draft.headingFontSize}
                          onChange={(e) =>
                            set("headingFontSize", Number(e.currentTarget.value))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel id="identity" current={section}>
                <div className="space-y-4">
                  <input
                    type="hidden"
                    name="logoUrl"
                    value={draft.logoUrl ?? ""}
                  />

                  <div className="flex items-center gap-4 rounded-lg border border-ink-200 bg-ink-50 px-3 py-3">
                    {draft.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={draft.logoUrl}
                        alt="Current logo"
                        className="h-10 w-auto max-w-40 rounded bg-white object-contain p-1"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-ink-700">
                        {storeName}
                      </span>
                    )}
                    <p className="text-xs text-ink-500">
                      {draft.logoUrl
                        ? "Shown at the top of the tracking page and every email."
                        : "No logo yet — your store name is used instead."}
                    </p>
                  </div>

                  {logoError ? <Alert tone="danger">{logoError}</Alert> : null}

                  <Field
                    label="Upload a logo"
                    htmlFor="brand-logo"
                    hint="PNG, JPG or WebP. A wide, transparent logo works best."
                  >
                    <input
                      ref={logoRef}
                      id="brand-logo"
                      type="file"
                      accept="image/*"
                      onChange={uploadLogo}
                      className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border file:border-ink-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium"
                    />
                  </Field>

                  {uploading ? (
                    <p className="text-xs text-ink-500">Uploading…</p>
                  ) : null}

                  {draft.logoUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => set("logoUrl", null)}
                    >
                      Remove logo
                    </Button>
                  ) : null}
                </div>
              </Panel>

              <Panel id="content" current={section}>
                <div className="space-y-4">
                  <Field label="Page title" htmlFor="brand-title">
                    <Input
                      id="brand-title"
                      name="pageTitle"
                      value={draft.pageTitle}
                      onChange={(e) => set("pageTitle", e.currentTarget.value)}
                    />
                  </Field>

                  <Field
                    label="Subtitle"
                    htmlFor="brand-subtitle"
                    hint="Shown above the lookup form, before an order is found."
                  >
                    <Input
                      id="brand-subtitle"
                      name="pageSubtitle"
                      value={draft.pageSubtitle}
                      onChange={(e) => set("pageSubtitle", e.currentTarget.value)}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Help banner text" htmlFor="brand-help">
                      <Input
                        id="brand-help"
                        name="helpBannerText"
                        value={draft.helpBannerText}
                        onChange={(e) =>
                          set("helpBannerText", e.currentTarget.value)
                        }
                      />
                    </Field>

                    <Field
                      label="Help banner link"
                      htmlFor="brand-help-url"
                      hint="Optional."
                    >
                      <Input
                        id="brand-help-url"
                        name="helpBannerUrl"
                        type="url"
                        placeholder={`https://${shopDomain}/pages/contact`}
                        value={draft.helpBannerUrl ?? ""}
                        onChange={(e) =>
                          set("helpBannerUrl", e.currentTarget.value || null)
                        }
                      />
                    </Field>
                  </div>

                  <Field label="Footer text" htmlFor="brand-footer">
                    <Input
                      id="brand-footer"
                      name="footerText"
                      value={draft.footerText}
                      onChange={(e) => set("footerText", e.currentTarget.value)}
                      placeholder={`${storeName} — order tracking`}
                    />
                  </Field>
                </div>
              </Panel>

              <Panel id="faq" current={section}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-ink-600">
                      {faq.length === 0
                        ? "No questions yet."
                        : `${faq.length} question${faq.length === 1 ? "" : "s"}, shown as an accordion under the timeline.`}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setFaq((c) => [...c, { question: "", answer: "" }])
                      }
                    >
                      Add question
                    </Button>
                  </div>

                  {faq.map((entry, index) => (
                    <div
                      key={index}
                      className="space-y-2 rounded-lg border border-ink-200 p-3"
                    >
                      <Field label={`Question ${index + 1}`} htmlFor={`faq-q-${index}`}>
                        <Input
                          id={`faq-q-${index}`}
                          name="faqQuestion"
                          value={entry.question}
                          onChange={(e) =>
                            setFaq((c) =>
                              c.map((row, i) =>
                                i === index
                                  ? { ...row, question: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label="Answer" htmlFor={`faq-a-${index}`}>
                        <Textarea
                          id={`faq-a-${index}`}
                          name="faqAnswer"
                          rows={2}
                          value={entry.answer}
                          onChange={(e) =>
                            setFaq((c) =>
                              c.map((row, i) =>
                                i === index
                                  ? { ...row, answer: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setFaq((c) => c.filter((_, i) => i !== index))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel id="layout" current={section}>
                <div className="space-y-3">
                  <Checkbox
                    id="brand-show-summary"
                    name="showOrderSummary"
                    label="Show the order summary"
                    description="Items, quantities and total on the tracking page."
                    checked={draft.showOrderSummary}
                    onChange={(e) =>
                      set("showOrderSummary", e.currentTarget.checked)
                    }
                  />
                  <Checkbox
                    id="brand-show-address"
                    name="showAddressEditing"
                    label="Let customers edit their address"
                    description="Only until the order reaches a stage that locks the address."
                    checked={draft.showAddressEditing}
                    onChange={(e) =>
                      set("showAddressEditing", e.currentTarget.checked)
                    }
                  />
                </div>
              </Panel>
            </div>

            {/* Save bar, always reachable regardless of the open section. */}
            <div className="flex flex-wrap items-center gap-3 border-t border-ink-200 bg-ink-50 px-4 py-3 sm:px-5">
              <SubmitButton pendingLabel="Saving…">Save branding</SubmitButton>
              <p className="text-xs text-ink-500">
                Applies to the tracking page and every email.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-ink-200 bg-white px-4 py-3.5 shadow-sm">
            <ResetBrandingForm />
          </div>
        </div>

        {/* ------------------------- Preview ------------------------- */}
        <div className="space-y-2 xl:sticky xl:top-20 xl:self-start">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink-700">Live preview</p>
            <p className="text-xs text-ink-400">Example order</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
            <div className="max-h-[78dvh] overflow-y-auto">
              <TrackingPage
                branding={previewBranding}
                store={{ name: storeName, shopDomain }}
                view={sample}
                proxyPath="#"
                lookupStep={{ step: "identify" }}
              />
            </div>
          </div>
          <p className="text-xs text-ink-400">
            The order shown is an example used for previewing only. Real
            tracking pages show nothing but recorded events.
          </p>
        </div>
      </div>
    </form>
  );
}

/** Hidden rather than unmounted, so switching tabs never drops a field. */
function Panel({
  id,
  current,
  children,
}: {
  id: SectionId;
  current: SectionId;
  children: React.ReactNode;
}) {
  return (
    <div
      id={`branding-panel-${id}`}
      role="tabpanel"
      hidden={id !== current}
      className={id === current ? undefined : "hidden"}
    >
      {children}
    </div>
  );
}

/**
 * Warns when body text would be hard to read on the chosen background.
 *
 * Branding is customer-facing, and a store can pick any two colours it likes —
 * including a pair nobody can read. WCAG AA for body text is 4.5:1.
 */
function ContrastHint({
  background,
  text,
}: {
  background: string;
  text: string;
}) {
  const ratio = contrastRatio(background, text);
  if (ratio === null || ratio >= 4.5) return null;

  return (
    <Alert tone="warning">
      Body text on this background measures {ratio.toFixed(1)}:1. Readable text
      needs at least 4.5:1 — customers on phones, in sunlight, will struggle.
    </Alert>
  );
}

function contrastRatio(a: string, b: string): number | null {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  if (lumA === null || lumB === null) return null;
  const [light, dark] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;

  let value = match[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ColorField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={`brand-${name}`}>
      <div className="flex items-center gap-2">
        <Input
          id={`brand-${name}`}
          name={name}
          type="color"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          className="h-10 w-14 shrink-0 p-1"
        />
        <Input
          aria-label={`${label} hex value`}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          className="font-mono text-xs"
        />
      </div>
    </Field>
  );
}

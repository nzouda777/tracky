"use client";

import { useActionState, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  applyDesignToAllTemplatesAction,
  createTemplateFromDesignAction,
} from "@/lib/actions/emails";
import type { ActionResult } from "@/lib/actions/result";
import { EMAIL_DESIGNS, type EmailDesignId } from "@/lib/email/designs/catalog";
import { cn } from "@/lib/utils";
import { DesignSwatches } from "./design-swatches";
import { ScaledEmailFrame } from "./email-frame";

export type DesignPreview = { id: EmailDesignId; html: string; subject: string };

/**
 * Every design, rendered with this store's branding and the same sample copy,
 * so the owner compares the designs and nothing else.
 *
 * Opening one shows it full size, at desktop or phone width, with the two
 * things you do with a design: start a template in it, or restyle every
 * template in the store with it.
 */
export function DesignGallery({
  previews,
  usage,
  templateCount,
}: {
  previews: DesignPreview[];
  /** How many of this store's templates use each design. */
  usage: Partial<Record<EmailDesignId, number>>;
  templateCount: number;
}) {
  const [openId, setOpenId] = useState<EmailDesignId | null>(null);
  const byId = new Map(previews.map((preview) => [preview.id, preview]));

  return (
    <>
      <ul className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {EMAIL_DESIGNS.map((design) => {
          const preview = byId.get(design.id);
          const count = usage[design.id] ?? 0;
          return (
            <li key={design.id}>
              <button
                type="button"
                onClick={() => setOpenId(design.id)}
                className="group block w-full overflow-hidden rounded-panel border border-line bg-white text-left transition hover:-translate-y-0.5 hover:border-ink-400 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dispatch"
              >
                <div className="relative border-b border-line bg-ink-50">
                  {preview ? (
                    <ScaledEmailFrame
                      html={preview.html}
                      title={`${design.name} design`}
                      className="h-80"
                    />
                  ) : (
                    <div className="h-80" />
                  )}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
                  <span className="absolute inset-0 flex items-center justify-center bg-ink-900/0 opacity-0 transition group-hover:bg-ink-900/25 group-hover:opacity-100">
                    <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow">
                      Preview
                    </span>
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{design.name}</p>
                    <p className="truncate text-xs text-ink-500">{design.tagline}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <DesignSwatches colors={design.swatches} />
                    {count > 0 ? (
                      <span className="text-[11px] font-medium text-ink-500">
                        In use · {count}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {openId ? (
        <DesignPreviewDialog
          designId={openId}
          previews={byId}
          templateCount={templateCount}
          onNavigate={setOpenId}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  );
}

function DesignPreviewDialog({
  designId,
  previews,
  templateCount,
  onNavigate,
  onClose,
}: {
  designId: EmailDesignId;
  previews: Map<EmailDesignId, DesignPreview>;
  templateCount: number;
  onNavigate: (id: EmailDesignId) => void;
  onClose: () => void;
}) {
  const index = EMAIL_DESIGNS.findIndex((design) => design.id === designId);
  const design = EMAIL_DESIGNS[index];
  const preview = previews.get(designId);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [confirming, setConfirming] = useState(false);

  const [createState, createAction] = useActionState<ActionResult, FormData>(
    createTemplateFromDesignAction,
    {},
  );
  const [applyState, applyAction] = useActionState<ActionResult, FormData>(
    applyDesignToAllTemplatesAction,
    {},
  );

  const step = (delta: number) => {
    const next = EMAIL_DESIGNS[(index + delta + EMAIL_DESIGNS.length) % EMAIL_DESIGNS.length];
    setConfirming(false);
    onNavigate(next.id);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${design.name} design preview`}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink-900/60 p-0 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:rounded-panel lg:flex-row">
        {/* Stage */}
        <div className="relative flex min-h-0 flex-1 flex-col bg-ink-100">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-white px-3 py-2">
            <div className="inline-flex rounded-control bg-ink-100 p-0.5 text-xs font-semibold">
              {(["desktop", "mobile"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDevice(option)}
                  aria-pressed={device === option}
                  className={cn(
                    "rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 capitalize transition",
                    device === option
                      ? "bg-white text-ink-900 shadow-sm"
                      : "text-ink-500 hover:text-ink-900",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => step(-1)} aria-label="Previous design">
                <Chevron direction="left" />
              </Button>
              <span className="text-xs tabular-nums text-ink-500">
                {index + 1} / {EMAIL_DESIGNS.length}
              </span>
              <Button variant="ghost" size="sm" onClick={() => step(1)} aria-label="Next design">
                <Chevron direction="right" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="lg:hidden" aria-label="Close">
                ✕
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 justify-center overflow-hidden p-3 sm:p-6">
            <div
              className={cn(
                "flex h-full w-full flex-col overflow-hidden bg-white shadow-xl transition-all duration-300",
                device === "mobile"
                  ? "max-w-[390px] rounded-[2rem] border-[10px] border-ink-900"
                  : "max-w-[720px] rounded-lg border border-line",
              )}
            >
              {device === "desktop" ? (
                <div className="flex items-center gap-1.5 border-b border-line bg-ink-50 px-3 py-2">
                  <span className="size-2.5 rounded-full bg-ink-300" />
                  <span className="size-2.5 rounded-full bg-ink-300" />
                  <span className="size-2.5 rounded-full bg-ink-300" />
                  <span className="ml-2 truncate text-xs text-ink-500">
                    {preview?.subject}
                  </span>
                </div>
              ) : null}
              <iframe
                key={`${designId}-${device}`}
                title={`${design.name} email preview`}
                srcDoc={preview?.html ?? ""}
                sandbox=""
                className="min-h-[60vh] w-full flex-1 bg-white lg:min-h-0"
              />
            </div>
          </div>
        </div>

        {/* Details */}
        <aside className="flex w-full shrink-0 flex-col gap-5 border-t border-line p-5 lg:w-80 lg:border-l lg:border-t-0">
          <div className="hidden justify-end lg:flex">
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              ✕
            </Button>
          </div>
          <div className="space-y-2">
            <DesignSwatches colors={design.swatches} />
            <h2 className="text-xl font-semibold tracking-tight text-ink-900">
              {design.name}
            </h2>
            <p className="text-sm font-medium text-ink-700">{design.tagline}</p>
            <p className="text-sm text-ink-500">{design.description}</p>
          </div>

          <p className="rounded-control bg-paper px-3 py-2 text-xs text-ink-600">
            Shown with your store&apos;s logo and colours and sample order data.
            Your template copy stays the same whatever design you pick.
          </p>

          <div className="mt-auto space-y-3">
            {createState.error ? <Alert tone="danger">{createState.error}</Alert> : null}
            <form action={createAction}>
              <input type="hidden" name="design" value={design.id} />
              <SubmitButton className="w-full" pendingLabel="Creating…">
                Use this design
              </SubmitButton>
            </form>

            {templateCount > 0 ? (
              <form action={applyAction} className="space-y-2">
                <input type="hidden" name="design" value={design.id} />
                {confirming ? (
                  <div className="space-y-2 rounded-control border border-line p-3">
                    <p className="text-xs text-ink-600">
                      Restyle all {templateCount} template
                      {templateCount === 1 ? "" : "s"} with {design.name}? Their
                      copy is not changed.
                    </p>
                    <div className="flex gap-2">
                      <SubmitButton size="sm" pendingLabel="Applying…">
                        Apply to all
                      </SubmitButton>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setConfirming(true)}
                  >
                    Apply to all templates
                  </Button>
                )}
              </form>
            ) : null}

            {applyState.error ? <Alert tone="danger">{applyState.error}</Alert> : null}
            {applyState.ok ? <Alert tone="success">{applyState.message}</Alert> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
      <path
        d={direction === "left" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

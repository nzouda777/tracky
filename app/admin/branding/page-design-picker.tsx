"use client";

import type { CSSProperties } from "react";

import {
  PAGE_DESIGNS,
  type PageDesign,
  type PageDesignId,
} from "@/lib/tracking/page-designs";
import { cn } from "@/lib/utils";

/**
 * The tracking page designs as a grid of miniature pages.
 *
 * The thumbnails are drawn, not rendered: the real page is scoped by a single
 * element id, so six live copies on one screen would style each other. The
 * big preview beside the editor is the real thing, and it switches the moment
 * a design is picked.
 */
export function PageDesignPicker({
  value,
  onPick,
}: {
  value: PageDesignId;
  onPick: (design: PageDesign) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Tracking page design" className="grid grid-cols-2 gap-3">
      {PAGE_DESIGNS.map((design) => {
        const selected = design.id === value;
        return (
          <button
            key={design.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(design)}
            className={cn(
              "group overflow-hidden rounded-lg border bg-white text-left transition",
              "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dispatch",
              selected
                ? "border-ink-900 ring-1 ring-ink-900"
                : "border-ink-200 hover:border-ink-400",
            )}
          >
            <Thumb design={design} />
            <span className="flex items-start justify-between gap-2 border-t border-ink-100 px-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">
                  {design.name}
                </span>
                <span className="block truncate text-xs text-ink-500">
                  {design.tagline}
                </span>
              </span>
              {selected ? (
                <span className="mt-0.5 shrink-0 rounded-full bg-ink-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Active
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A tiny tracking page: heading, the form band, a card with field + button. */
function Thumb({ design }: { design: PageDesign }) {
  const p = design.preset;
  const id = design.id;
  const band = p.sectionBackground ?? p.backgroundColor;
  const card = p.sectionBackground ? p.backgroundColor : band;
  const centred = p.contentAlignment === "center";

  const heading: CSSProperties = {
    color: p.textColor,
    fontFamily:
      id === "editorial"
        ? "Georgia, serif"
        : id === "athletic" || id === "noir"
          ? "Helvetica Neue, Helvetica, Arial, sans-serif"
          : undefined,
    fontWeight: id === "noir" ? 300 : id === "editorial" ? 400 : 800,
    textTransform: id === "athletic" || id === "noir" ? "uppercase" : "none",
    letterSpacing: id === "noir" ? "0.14em" : id === "athletic" ? "-0.03em" : "-0.02em",
    fontSize: id === "athletic" ? 15 : 13,
    lineHeight: 1,
  };

  const hero = id === "spotlight";

  return (
    <span
      aria-hidden
      className="block h-36 overflow-hidden px-3 pt-3"
      style={{ backgroundColor: p.backgroundColor }}
    >
      <span
        className="block"
        style={{
          textAlign: centred ? "center" : "left",
          ...(hero
            ? {
                backgroundColor: p.primaryColor,
                borderRadius: 10,
                padding: "8px 8px 9px",
              }
            : {}),
        }}
      >
        <span
          className="block"
          style={{ ...heading, color: hero ? "#FFFFFF" : heading.color }}
        >
          {id === "athletic" ? "Track it" : "Track your order"}
        </span>
        <span
          className="mt-1.5 inline-block h-1 w-16 rounded-full"
          style={{
            backgroundColor: hero ? "rgba(255,255,255,0.55)" : p.textColor,
            opacity: hero ? 1 : 0.25,
          }}
        />
      </span>

      <span
        className="-mx-3 mt-3 block px-3 py-3"
        style={{ backgroundColor: hero ? p.backgroundColor : band }}
      >
        <span
          className="block p-2"
          style={{
            backgroundColor: card,
            borderRadius: Math.min(p.cardRadius, 12),
            border:
              id === "athletic" || id === "minimal" || id === "spotlight"
                ? "0"
                : `1px solid ${id === "noir" ? "#262626" : "rgba(0,0,0,0.12)"}`,
            boxShadow:
              id === "minimal" || id === "spotlight"
                ? "0 4px 14px rgba(0,0,0,0.10)"
                : undefined,
          }}
        >
          <span
            className="block h-4"
            style={{
              borderRadius: id === "editorial" || id === "noir" ? 0 : Math.min(p.buttonRadius, 8),
              ...(id === "editorial" || id === "noir"
                ? { borderBottom: `1px solid ${id === "noir" ? "#3a3a3a" : "rgba(0,0,0,0.25)"}` }
                : {
                    border: "1px solid rgba(0,0,0,0.1)",
                    backgroundColor: id === "minimal" ? "#F5F5F7" : p.backgroundColor,
                  }),
            }}
          />
          <span
            className="mt-1.5 flex h-4 items-center justify-center text-[7px] font-semibold"
            style={{
              backgroundColor: p.primaryColor,
              color: id === "noir" ? "#0A0A0A" : "#FFFFFF",
              borderRadius: Math.min(p.buttonRadius, 999),
              letterSpacing: id === "editorial" || id === "noir" ? "0.2em" : 0,
              textTransform: id === "editorial" || id === "noir" ? "uppercase" : "none",
            }}
          >
            Track
          </span>
        </span>
      </span>
    </span>
  );
}

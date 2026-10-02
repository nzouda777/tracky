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
  if (design.layout === "split") return <SplitThumb design={design} />;
  if (design.layout === "ticket") return <TicketThumb design={design} />;
  if (design.layout === "journey") return <JourneyThumb design={design} />;
  if (design.layout === "atelier") return <AtelierThumb design={design} />;
  if (design.layout === "beaute") return <BeauteThumb design={design} />;
  if (design.layout === "maison") return <MaisonThumb design={design} />;
  return <ColumnThumb design={design} />;
}

/** A Didone wordmark over a numbered index between hairlines. */
function AtelierThumb({ design }: { design: PageDesign }) {
  const p = design.preset;
  return (
    <span aria-hidden className="block h-36 overflow-hidden px-3 pt-3" style={{ backgroundColor: p.backgroundColor, color: p.textColor }}>
      <span
        className="block border-b pb-1.5 text-center text-[20px] uppercase leading-none"
        style={{ fontFamily: "Didot, 'Bodoni 72', Georgia, serif", letterSpacing: "0.04em", borderColor: p.textColor }}
      >
        Store
      </span>
      <span className="mt-2 flex gap-3">
        <span className="block w-[38%]">
          <span className="block text-[5px] uppercase" style={{ letterSpacing: "0.12em" }}>Order #1042</span>
          <span className="mt-0.5 block text-[11px] uppercase leading-tight" style={{ fontFamily: "Didot, 'Bodoni 72', Georgia, serif" }}>
            Confirmed
          </span>
        </span>
        <span className="block flex-1 border-b" style={{ borderColor: p.textColor }}>
          {["Placed", "Confirmed", "Packed", "Delivered"].map((name, i) => (
            <span
              key={name}
              className="flex justify-between border-t py-[3px] text-[5px] uppercase"
              style={{ borderColor: p.textColor, letterSpacing: "0.12em", fontWeight: i === 1 ? 700 : 400, opacity: i > 1 ? 0.45 : 1 }}
            >
              <span>0{i + 1}</span>
              <span>{name}</span>
              <span>{i < 1 ? "Done" : i === 1 ? "Now" : "—"}</span>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

/** Black bar, stripe band, bold headline and a stat strip. */
function BeauteThumb({ design }: { design: PageDesign }) {
  const p = design.preset;
  const stripes = `repeating-linear-gradient(90deg, ${p.textColor} 0 6px, ${p.backgroundColor} 6px 12px)`;
  return (
    <span aria-hidden className="block h-36 overflow-hidden" style={{ backgroundColor: p.backgroundColor, color: p.textColor }}>
      <span className="block py-1.5 text-center text-[8px] font-extrabold uppercase" style={{ backgroundColor: p.textColor, color: p.backgroundColor, letterSpacing: "0.18em" }}>
        Store
      </span>
      <span className="block h-1.5" style={{ background: stripes }} />
      <span className="block px-3 pt-2.5 text-center">
        <span className="block text-[5px] font-extrabold uppercase" style={{ color: p.secondaryColor, letterSpacing: "0.12em" }}>
          Order update
        </span>
        <span className="block text-[13px] font-extrabold leading-tight tracking-tight">Shipped!</span>
        <span className="mt-2 grid grid-cols-3 gap-1 px-1 py-1.5" style={{ backgroundColor: p.sectionBackground ?? p.backgroundColor }}>
          {["#1042", "28 Sep", "2 of 4"].map((value) => (
            <span key={value} className="block text-[6px] font-bold">{value}</span>
          ))}
        </span>
        <span className="mt-1.5 block py-1 text-[6px] font-extrabold uppercase" style={{ backgroundColor: p.textColor, color: p.backgroundColor, letterSpacing: "0.12em" }}>
          Track
        </span>
      </span>
      <span className="mt-2 block h-1.5" style={{ background: stripes }} />
    </span>
  );
}

/** A gold monogram over a double-framed letter card on cream. */
function MaisonThumb({ design }: { design: PageDesign }) {
  const p = design.preset;
  return (
    <span aria-hidden className="flex h-36 flex-col items-center overflow-hidden px-4 pt-2.5" style={{ backgroundColor: p.backgroundColor, color: p.textColor, fontFamily: "Georgia, serif" }}>
      <span className="grid size-5 place-items-center rounded-full border text-[7px]" style={{ borderColor: p.secondaryColor }}>
        NS
      </span>
      <span className="mt-2 block w-full border p-[3px]" style={{ borderColor: p.secondaryColor, backgroundColor: p.sectionBackground ?? p.backgroundColor }}>
        <span className="flex flex-col items-center gap-1 border px-2 py-2.5" style={{ borderColor: p.secondaryColor }}>
          <span className="text-[4px] uppercase" style={{ letterSpacing: "0.3em", opacity: 0.6 }}>Order #1042</span>
          <span className="text-[10px] uppercase" style={{ letterSpacing: "0.06em" }}>Confirmed</span>
          <span className="block h-px w-5" style={{ backgroundColor: p.secondaryColor }} />
          <span className="text-[6px] italic">Dear Sarah J.,</span>
          <span className="mt-0.5 block w-3/4 border-b" style={{ borderColor: p.textColor, opacity: 0.4 }} />
        </span>
      </span>
    </span>
  );
}

/** Brand panel on the left, details on the right. */
function SplitThumb({ design }: { design: PageDesign }) {
  const p = design.preset;
  return (
    <span aria-hidden className="flex h-36 overflow-hidden" style={{ backgroundColor: p.backgroundColor }}>
      <span className="flex w-[42%] flex-col justify-center gap-1.5 px-2.5" style={{ backgroundColor: p.primaryColor }}>
        <span className="h-1 w-8 rounded-full bg-white/50" />
        <span className="text-[13px] font-extrabold leading-none tracking-tight text-white">
          Out for delivery
        </span>
        <span className="mt-1 flex gap-0.5">
          {[1, 1, 1, 0, 0].map((on, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-full", on ? "bg-white" : "bg-white/30")} />
          ))}
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-2.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block rounded-md p-1.5 shadow-sm ring-1 ring-black/5">
            <span className="block h-1 w-2/3 rounded-full" style={{ backgroundColor: p.textColor, opacity: 0.6 }} />
            <span className="mt-1 block h-1 w-1/3 rounded-full" style={{ backgroundColor: p.textColor, opacity: 0.25 }} />
          </span>
        ))}
      </span>
    </span>
  );
}

/** A boarding pass with a tear line and barcode stub. */
function TicketThumb({ design }: { design: PageDesign }) {
  const p = design.preset;
  return (
    <span aria-hidden className="flex h-36 items-center justify-center px-4" style={{ backgroundColor: p.backgroundColor }}>
      <span className="relative block w-full overflow-visible rounded-lg bg-white shadow-md">
        <span className="flex justify-between rounded-t-lg px-2 py-1 text-[6px] font-bold uppercase text-white" style={{ backgroundColor: p.primaryColor, letterSpacing: "0.12em" }}>
          <span>Store</span>
          <span>Boarding pass</span>
        </span>
        <span className="flex items-center justify-between px-2 pt-1.5 text-[9px] font-extrabold" style={{ color: p.textColor }}>
          <span>28 Sep</span>
          <span style={{ color: p.primaryColor }}>✈</span>
          <span>Melbourne</span>
        </span>
        <span className="block px-2 pb-1.5 text-[12px] font-extrabold leading-tight" style={{ color: p.textColor }}>
          Confirmed
        </span>
        <span className="relative block border-t-2 border-dashed" style={{ borderColor: "rgba(0,0,0,0.15)" }}>
          <span className="absolute -left-1.5 -top-1.5 size-3 rounded-full" style={{ backgroundColor: p.backgroundColor }} />
          <span className="absolute -right-1.5 -top-1.5 size-3 rounded-full" style={{ backgroundColor: p.backgroundColor }} />
        </span>
        <span
          className="m-2 block h-4 w-2/3"
          style={{
            background: `repeating-linear-gradient(90deg, ${p.textColor} 0 1px, transparent 1px 3px, ${p.textColor} 3px 5px, transparent 5px 6px)`,
          }}
        />
      </span>
    </span>
  );
}

/** Giant status, a segmented bar and numbered step cards. */
function JourneyThumb({ design }: { design: PageDesign }) {
  const p = design.preset;
  return (
    <span aria-hidden className="block h-36 overflow-hidden px-3 pt-3" style={{ backgroundColor: p.backgroundColor }}>
      <span className="block text-[15px] font-extrabold leading-none tracking-tight" style={{ color: p.textColor }}>
        Processing
      </span>
      <span className="mt-1.5 flex gap-0.5">
        {[1, 1, 1, 0, 0].map((on, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: on ? p.primaryColor : "rgba(0,0,0,0.1)" }}
          />
        ))}
      </span>
      <span className="mt-2 flex flex-col gap-1">
        {["Done", "Done", "Now", "Next"].map((state, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[7px] font-bold"
            style={
              state === "Now"
                ? { backgroundColor: p.primaryColor, color: "#FFFFFF" }
                : { border: "1px solid rgba(0,0,0,0.1)", color: p.textColor, opacity: state === "Next" ? 0.5 : 1 }
            }
          >
            <span className="grid size-3 place-items-center rounded-full bg-black/10">{i + 1}</span>
            Step
            <span className="ml-auto">{state}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

function ColumnThumb({ design }: { design: PageDesign }) {
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

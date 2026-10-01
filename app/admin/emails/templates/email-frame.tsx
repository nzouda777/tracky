"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Renders an email at its real width, scaled down to fit its box.
 *
 * Emails are laid out for ~600px. Squeezing one into a 300px thumbnail would
 * make it reflow into its mobile layout, which is not what the owner is
 * choosing between — so it is drawn at full width and shrunk instead.
 */
export function ScaledEmailFrame({
  html,
  title,
  width = 640,
  className,
}: {
  html: string;
  title: string;
  width?: number;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / width);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={boxRef} className={cn("relative overflow-hidden", className)}>
      <iframe
        title={title}
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
        style={{
          width,
          height: `${100 / scale}%`,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}

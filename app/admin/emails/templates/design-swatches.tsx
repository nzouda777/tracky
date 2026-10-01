import { cn } from "@/lib/utils";

/** The three colours that define a design, as overlapping dots. */
export function DesignSwatches({
  colors,
  className,
}: {
  colors: readonly string[];
  className?: string;
}) {
  return (
    <span className={cn("flex -space-x-1.5", className)} aria-hidden>
      {colors.map((color) => (
        <span
          key={color}
          className="size-4 rounded-full ring-2 ring-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

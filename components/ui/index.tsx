import * as React from "react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-dispatch text-white hover:bg-ink-900 disabled:hover:bg-dispatch border border-transparent",
  secondary:
    "bg-white text-ink-900 border border-line hover:bg-paper disabled:hover:bg-white",
  danger:
    "bg-white text-alert border border-alert hover:bg-paper disabled:hover:bg-white",
  ghost:
    "bg-transparent text-ink-700 border border-transparent hover:bg-ink-100 disabled:hover:bg-transparent",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  // Large enough to be a comfortable one-handed tap target in the agency UI.
  lg: "h-12 px-5 text-base gap-2",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-control font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

const FIELD_BASE =
  "w-full rounded-control border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 disabled:bg-ink-100 disabled:text-ink-500";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD_BASE, "h-10", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(FIELD_BASE, "min-h-24", className)} {...props} />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD_BASE, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

/** Label + control + optional hint/error, wired up with ids for screen readers. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink-800"
      >
        {label}
        {required ? <span className="ml-0.5 text-alert">*</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
}) {
  const id = props.id ?? props.name;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 rounded border-ink-300 text-ink-900"
        {...props}
      />
      <div className="space-y-0.5">
        <label htmlFor={id} className="block text-sm font-medium text-ink-800">
          {label}
        </label>
        {description ? (
          <p className="text-xs text-ink-500">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout & feedback
// ---------------------------------------------------------------------------

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-panel border border-line bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5",
        className,
      )}
    >
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description ? (
          <p className="text-xs text-ink-500">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>;
}

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * The operation's own status colours, not a generic semantic set: forest green
 * for what arrived, hi-vis amber for what is moving, brick for what went
 * wrong. Every one of them is a tint behind ink-weight text rather than a
 * saturated block, so a table of badges stays a table.
 */
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  info: "bg-[#eaeef5] text-[#1b2b44] ring-[#c6d0e0]",
  success: "bg-[#e8f1ec] text-[#1f5c41] ring-[#bdd8cb]",
  warning: "bg-[#fdf1dc] text-[#7a5310] ring-[#f3ddb0]",
  danger: "bg-[#f9eae7] text-[#8f2f1f] ring-[#eec7bf]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-control px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: BadgeTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "border-line bg-paper text-ink-700",
    info: "border-[#c6d0e0] bg-[#eaeef5] text-[#1b2b44]",
    success: "border-[#bdd8cb] bg-[#e8f1ec] text-[#1f5c41]",
    warning: "border-[#f3ddb0] bg-[#fdf1dc] text-[#7a5310]",
    danger: "border-[#eec7bf] bg-[#f9eae7] text-[#8f2f1f]",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-panel border px-4 py-3 text-sm", tones[tone], className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : undefined}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-ink-500">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

/** Horizontally scrollable wrapper so wide tables never break the layout. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-paper px-4 py-2 text-left text-xs font-semibold text-ink-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  className,
  children,
  colSpan,
}: {
  className?: string;
  children?: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-ink-100 px-4 py-3 align-middle text-ink-800",
        className,
      )}
    >
      {children}
    </td>
  );
}

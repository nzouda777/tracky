import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Turns free text into a stable, URL-safe slug used for stage keys. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** `5 Oct 2025` — short, unambiguous, locale-independent. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** `5 Oct 2025, 3:42 pm` */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatMoney(
  amount: string | number | null | undefined,
  currency = "AUD",
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** "2 hours ago" — used for the "last update" block on the tracking page. */
export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.35],
    ["month", 12],
  ];

  let remaining = seconds;
  for (const [unit, step] of thresholds) {
    if (Math.abs(remaining) < step) {
      return formatter.format(-Math.round(remaining), unit);
    }
    remaining /= step;
  }
  return formatter.format(-Math.round(remaining), "year");
}

/** Renders a shipping address as the lines a courier would read. */
export function formatAddressLines(
  address:
    | {
        name?: string | null;
        company?: string | null;
        address1?: string | null;
        address2?: string | null;
        city?: string | null;
        province?: string | null;
        zip?: string | null;
        country?: string | null;
      }
    | null
    | undefined,
): string[] {
  if (!address) return [];
  const cityLine = [address.city, address.province, address.zip]
    .filter(Boolean)
    .join(" ");
  return [
    address.name,
    address.company,
    address.address1,
    address.address2,
    cityLine,
    address.country,
  ]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
}

export function formatAddressOneLine(
  address: Parameters<typeof formatAddressLines>[0],
): string {
  const lines = formatAddressLines(address);
  return lines.length > 0 ? lines.join(", ") : "—";
}

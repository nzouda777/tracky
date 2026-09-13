import type { BrandingSettings } from "@/lib/db";

/** The defaults used when a store has no branding row yet. */
export const BRANDING_FALLBACK = {
  primaryColor: "#111827",
  secondaryColor: "#6b7280",
  backgroundColor: "#ffffff",
  textColor: "#111827",
  accentColor: "#2563eb",
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  baseFontSize: 16,
  headingFontSize: 24,
  pageTitle: "Track your order",
  pageSubtitle: "Enter your details to see the latest delivery update.",
  helpBannerText: "Need help with your order? Contact our support team.",
  logoUrl: null as string | null,
  helpBannerUrl: null as string | null,
  footerText: "",
  faq: [] as Array<{ question: string; answer: string }>,
  showOrderSummary: true,
  showAddressEditing: true,
} as const;

export type Branding = Omit<
  BrandingSettings,
  "id" | "storeId" | "createdAt" | "updatedAt"
>;

/** Merges a possibly-missing branding row with the defaults. */
export function resolveBranding(
  branding: BrandingSettings | null | undefined,
): Branding {
  return {
    ...BRANDING_FALLBACK,
    ...(branding ?? {}),
    faq: branding?.faq ?? [],
  } as Branding;
}

/**
 * Exposes branding as CSS custom properties on a wrapper element, so the whole
 * page themes itself from the store's settings without inline styles on every
 * node. A `<style>` scoped by the wrapper id keeps it out of the global sheet.
 */
export function BrandingStyle({
  branding,
  scopeId,
}: {
  branding: Branding;
  scopeId: string;
}) {
  const css = `
#${scopeId} {
  --brand-primary: ${branding.primaryColor};
  --brand-secondary: ${branding.secondaryColor};
  --brand-background: ${branding.backgroundColor};
  --brand-text: ${branding.textColor};
  --brand-accent: ${branding.accentColor};
  --brand-font: ${branding.fontFamily};
  --brand-base-size: ${branding.baseFontSize}px;
  --brand-heading-size: ${branding.headingFontSize}px;
  --brand-muted: color-mix(in srgb, ${branding.textColor} 60%, ${branding.backgroundColor});
  --brand-border: color-mix(in srgb, ${branding.textColor} 14%, ${branding.backgroundColor});
  --brand-surface: color-mix(in srgb, ${branding.textColor} 4%, ${branding.backgroundColor});
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

import { optional } from "@/lib/env";

/**
 * The facts the legal pages state about the business behind Tracky.
 *
 * Read from the environment rather than written into the pages, because they
 * belong to whoever operates this deployment. Anything left unset is simply
 * not stated — a page never shows a placeholder like "[Company name]".
 */
export function legalDetails() {
  return {
    /** The legal entity that operates the service, e.g. "Tracky Pty Ltd". */
    entity: optional("LEGAL_ENTITY_NAME", "") || optional("PLATFORM_NAME", "Tracky"),
    /** Registered postal address, on one line. */
    address: optional("LEGAL_ADDRESS", "") || null,
    /** Governing law for the terms, e.g. "Victoria, Australia". */
    jurisdiction: optional("LEGAL_JURISDICTION", "") || null,
    /** Where privacy and legal questions go; falls back to the contact address. */
    email: optional("LEGAL_EMAIL", "") || optional("CONTACT_EMAIL", "") || null,
  };
}

/** Shown at the top of every legal page. Update when the text changes. */
export const LEGAL_UPDATED = "October 28, 2026";

export const LEGAL_PAGES = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of service" },
  { href: "/cookies", label: "Cookie policy" },
] as const;

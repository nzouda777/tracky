"use client";

import { useActionState, useRef, useState } from "react";

import { Alert, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendContactMessage, type ContactState } from "./actions";

export function ContactForm({ fallbackAddress }: { fallbackAddress: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  // Stamped once when the form mounts. A submission that arrives within two
  // seconds of it was not typed by a person. Lazy state rather than a ref,
  // because a ref may not be read during render.
  const [renderedAt] = useState(() => Date.now());

  const [state, formAction] = useActionState<ContactState, FormData>(
    async (previous, formData) => {
      const result = await sendContactMessage(previous, formData);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    {},
  );

  if (state.ok) {
    return (
      <Alert tone="success" title="Message sent">
        Thanks — we have it, and we will reply to the address you gave. If it is
        urgent and you do not hear back, email us directly
        {fallbackAddress ? ` at ${fallbackAddress}` : ""}.
      </Alert>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="renderedAt" value={renderedAt} />

      {/* Honeypot: hidden from people, irresistible to form bots. */}
      <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="name" error={state.fieldErrors?.name} required>
          <Input id="name" name="name" autoComplete="name" required />
        </Field>

        <Field label="Store or company" htmlFor="company" hint="Optional.">
          <Input id="company" name="company" autoComplete="organization" />
        </Field>
      </div>

      <Field label="Email address" htmlFor="email" error={state.fieldErrors?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>

      <Field
        label="How do your deliveries work?"
        htmlFor="message"
        hint="Roughly how many orders a week, who delivers them, and what you need from a tracking page."
        error={state.fieldErrors?.message}
        required
      >
        <Textarea id="message" name="message" rows={6} required />
      </Field>

      <SubmitButton size="lg" pendingLabel="Sending…">
        Send message
      </SubmitButton>

      <p className="text-xs text-ink-500">
        We use what you send only to reply to you. Nothing else.
      </p>
    </form>
  );
}

"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import { Button } from "./index";

/**
 * Submit button that reflects the pending state of its enclosing <form>.
 * Every mutating form in the app uses it, so a slow action always shows
 * feedback and cannot be double-submitted.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? (pendingLabel ?? "Working…") : children}
    </Button>
  );
}

"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState, useTransition } from "react";

import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { markDeliveredAction } from "@/lib/actions/orders";
import type { ActionResult } from "@/lib/actions/result";

/**
 * The delivery declaration.
 *
 * The customer has already signed a PAPER delivery note in person; this form
 * records that fact. The optional photo is a picture of that signed note —
 * there is no signature pad and no digital signature capture anywhere here.
 *
 * The photo goes straight from the browser to Vercel Blob (so a large phone
 * photo never passes through a server action), and only its URL is submitted.
 */
export function MarkDeliveredForm({
  orderId,
  storeId,
  terminalStageName,
  defaultRecipient,
  disabled,
}: {
  orderId: string;
  storeId: string;
  terminalStageName: string;
  defaultRecipient: string | null;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ActionResult>({});
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setState({});

    const file = fileRef.current?.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const blob = await upload(
          `pod/${storeId}/${orderId}-${Date.now()}-${file.name}`,
          file,
          { access: "public", handleUploadUrl: "/api/blob/upload" },
        );
        formData.set("paperSignaturePhotoUrl", blob.url);
      } catch (error) {
        setUploading(false);
        setState({
          error:
            error instanceof Error
              ? `The photo could not be uploaded: ${error.message}`
              : "The photo could not be uploaded.",
        });
        return;
      }
      setUploading(false);
    }

    // The photo input itself must not be submitted to the server action.
    formData.delete("photo");

    startTransition(async () => {
      const result = await markDeliveredAction({}, formData);
      setState(result);
      if (result.ok) form.reset();
    });
  }

  const busy = uploading || isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Alert tone="info">
        Only use this once the parcel has been handed over and the customer has
        signed the paper delivery note. It moves the order to{" "}
        <strong>{terminalStageName}</strong> and, if fulfillment is enabled,
        fulfils it in Shopify.
      </Alert>

      <Field
        label="Signed for by"
        htmlFor="pod-recipient"
        hint="Optional. The name written on the paper note."
      >
        <Input
          id="pod-recipient"
          name="recipientName"
          className="h-12 text-base"
          defaultValue={defaultRecipient ?? ""}
          autoComplete="off"
        />
      </Field>

      <Field
        label="Delivered at"
        htmlFor="pod-delivered-at"
        hint="Leave empty to use the current time."
      >
        <Input
          id="pod-delivered-at"
          name="deliveredAt"
          type="datetime-local"
          className="h-12 text-base"
        />
      </Field>

      <Field
        label="Photo of the signed delivery note"
        htmlFor="pod-photo"
        hint="Optional. Stored privately with the order — never shown to the customer."
      >
        <input
          ref={fileRef}
          id="pod-photo"
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border file:border-ink-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </Field>

      <Field label="Notes" htmlFor="pod-notes">
        <Textarea
          id="pod-notes"
          name="notes"
          rows={2}
          className="text-base"
          placeholder="e.g. Left with the customer at the front door."
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={busy || disabled}
      >
        {uploading
          ? "Uploading photo…"
          : isPending
            ? "Recording delivery…"
            : "Confirm delivery"}
      </Button>
    </form>
  );
}

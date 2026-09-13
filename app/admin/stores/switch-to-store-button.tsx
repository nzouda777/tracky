"use client";

import { SubmitButton } from "@/components/ui/submit-button";
import { switchStoreAction } from "@/lib/actions/store";

/** Makes another store the active one and lands on its dashboard. */
export function SwitchToStoreButton({ storeId }: { storeId: string }) {
  return (
    <form action={switchStoreAction}>
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="returnTo" value="/admin" />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Switching…">
        Open
      </SubmitButton>
    </form>
  );
}

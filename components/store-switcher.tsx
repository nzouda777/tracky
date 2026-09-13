"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";

import { switchStoreAction } from "@/lib/actions/store";
import type { Membership } from "@/lib/auth/session";

/**
 * Active-store selector for users who belong to more than one store.
 * Submits on change and falls back to a visible button without JavaScript.
 */
export function StoreSwitcher({
  memberships,
  activeStoreId,
}: {
  memberships: Membership[];
  activeStoreId: string;
}) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);

  if (memberships.length <= 1) {
    const only = memberships[0];
    return (
      <span className="truncate text-sm font-medium text-ink-700">
        {only ? (only.store.name ?? only.store.shopDomain) : "No store"}
      </span>
    );
  }

  return (
    <form ref={formRef} action={switchStoreAction} className="flex items-center gap-2">
      <input type="hidden" name="returnTo" value={pathname} />
      <label htmlFor="store-switcher" className="sr-only">
        Active store
      </label>
      <select
        id="store-switcher"
        name="storeId"
        defaultValue={activeStoreId}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-9 max-w-52 truncate rounded-lg border border-ink-300 bg-white px-2 text-sm text-ink-900"
      >
        {memberships.map(({ store, membership }) => (
          <option key={store.id} value={store.id}>
            {(store.name ?? store.shopDomain) +
              (membership.role === "agency" ? " (agency)" : "")}
          </option>
        ))}
      </select>
      <noscript>
        <button
          type="submit"
          className="h-9 rounded-lg border border-ink-300 px-3 text-sm"
        >
          Switch
        </button>
      </noscript>
    </form>
  );
}

import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { PageHeader } from "@/components/ui";
import { IconExternal } from "@/components/icons";
import { resolveBranding } from "@/components/tracking/branding";
import { requireOwner } from "@/lib/auth/session";
import { brandingSettings, stages } from "@/lib/db";
import { buildTrackingLookupLink } from "@/lib/tracking/links";
import { BrandingEditor } from "./branding-editor";

export const metadata: Metadata = { title: "Branding" };

export default async function BrandingPage() {
  const { tdb, store } = await requireOwner();

  const name = store.name ?? store.shopDomain;

  const [row, allStages] = await Promise.all([
    tdb.findFirst(brandingSettings),
    tdb.findMany(stages, { orderBy: asc(stages.position) }),
  ]);

  return (
    <div className="space-y-6">
      {/* Branding is per store, and the editor looks identical whichever one
          is open — so the store is named here rather than left to the switcher
          in the top bar. Editing the wrong store's palette and then checking
          the right store's tracking page looks exactly like "my changes did
          nothing", and nothing on the screen would have contradicted it. */}
      <PageHeader
        title="Branding"
        description={`Style the tracking page and emails for ${name}. Changes preview instantly and apply to this store only.`}
        action={
          <a
            href={buildTrackingLookupLink(store)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-600 underline underline-offset-2 hover:text-ink-900"
          >
            Open the live page
            <IconExternal className="size-3.5" />
          </a>
        }
      />

      <BrandingEditor
        branding={resolveBranding(row)}
        stages={allStages}
        storeId={store.id}
        storeName={name}
        shopDomain={store.shopDomain}
      />
    </div>
  );
}

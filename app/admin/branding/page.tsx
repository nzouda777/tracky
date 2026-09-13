import type { Metadata } from "next";
import { asc } from "drizzle-orm";

import { PageHeader } from "@/components/ui";
import { resolveBranding } from "@/components/tracking/branding";
import { requireOwner } from "@/lib/auth/session";
import { brandingSettings, stages } from "@/lib/db";
import { BrandingEditor } from "./branding-editor";

export const metadata: Metadata = { title: "Branding" };

export default async function BrandingPage() {
  const { tdb, store } = await requireOwner();

  const [row, allStages] = await Promise.all([
    tdb.findFirst(brandingSettings),
    tdb.findMany(stages, { orderBy: asc(stages.position) }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branding"
        description="Style the customer tracking page and your emails. Changes preview instantly and apply to this store only."
      />

      <BrandingEditor
        branding={resolveBranding(row)}
        stages={allStages}
        storeId={store.id}
        storeName={store.name ?? store.shopDomain}
        shopDomain={store.shopDomain}
      />
    </div>
  );
}

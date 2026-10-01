import { AthleticLayout } from "./athletic";
import { resolveEmailDesign, type EmailDesignId } from "./catalog";
import { ClassicLayout } from "./classic";
import { EditorialLayout } from "./editorial";
import { MinimalLayout } from "./minimal";
import { NoirLayout } from "./noir";
import type { DesignLayout } from "./shared";
import { SpotlightLayout } from "./spotlight";

export * from "./catalog";

const LAYOUTS: Record<EmailDesignId, DesignLayout> = {
  classic: ClassicLayout,
  athletic: AthleticLayout,
  editorial: EditorialLayout,
  noir: NoirLayout,
  minimal: MinimalLayout,
  spotlight: SpotlightLayout,
};

/** The layout for a stored design id; unknown ids fall back to the default. */
export function layoutFor(design: unknown): DesignLayout {
  return LAYOUTS[resolveEmailDesign(design)];
}

import { AtelierLayout } from "./atelier";
import { AthleticLayout } from "./athletic";
import { BeauteLayout } from "./beaute";
import { resolveEmailDesign, type EmailDesignId } from "./catalog";
import { ClassicLayout } from "./classic";
import { EditorialLayout } from "./editorial";
import { HoomaLayout } from "./hooma";
import { JourneyLayout } from "./journey";
import { MaisonLayout } from "./maison";
import { MinimalLayout } from "./minimal";
import { NoirLayout } from "./noir";
import type { DesignLayout } from "./shared";
import { ShowroomLayout } from "./showroom";
import { SpotlightLayout } from "./spotlight";
import { TicketLayout } from "./ticket";

export * from "./catalog";

const LAYOUTS: Record<EmailDesignId, DesignLayout> = {
  classic: ClassicLayout,
  athletic: AthleticLayout,
  editorial: EditorialLayout,
  noir: NoirLayout,
  minimal: MinimalLayout,
  spotlight: SpotlightLayout,
  atelier: AtelierLayout,
  beaute: BeauteLayout,
  maison: MaisonLayout,
  showroom: ShowroomLayout,
  ticket: TicketLayout,
  journey: JourneyLayout,
  hooma: HoomaLayout,
};

/** The layout for a stored design id; unknown ids fall back to the default. */
export function layoutFor(design: unknown): DesignLayout {
  return LAYOUTS[resolveEmailDesign(design)];
}

import { alpha } from "@mui/material/styles";
import { HEADING_FONT } from "@/components/page/flow/flowStyles";

// Shared look of the methodology page (mockup v2, "Metodología").

export { HEADING_FONT };

/** The fixed header's height plus some air, so an anchor's heading isn't under it. */
export const SCROLL_MARGIN_TOP = 80;

/** Result chips: green without findings, red with findings. */
export const RESULT_COLORS = {
  ok: { color: "#1f7a45", background: "#e3f4ea" },
  flagged: { color: "#b83227", background: "#fdeceb" },
} as const;

/** A neutral chip (a category's threshold). */
export const NEUTRAL_CHIP_BACKGROUND = "#eef2f6";

/** The header row of a layer table. */
export const TABLE_HEADER_BACKGROUND = "#f7fafc";

/** A category's color as a light background. */
export const categoryTint = (color: string) => alpha(color, 0.1);

import { keyframes } from "@mui/material/styles";

// Shared look of the flow header and the next-stage card (mockup v2).

export const FLOW_COLORS = {
  /** Light green: completed stages and bars, on the dark header. */
  leaf: "#5cc08a",
  leafInk: "#06301f",
  /** Dark green: eyebrows and section icons, on light backgrounds. */
  leafDark: "#2f8f5e",
  mint: "#eef7f1",
  forestInk: "#0e3b30",
  white: "#ffffff",
} as const;

const FOREST_IMAGE = "/images/aerial-river-rainforest.jpg";

/** Navy-to-forest gradient over the forest image, for the flow header. */
export const flowHeaderBackground = `linear-gradient(95deg, rgba(10, 36, 64, 0.94), rgba(14, 59, 48, 0.88)), url(${FOREST_IMAGE}) center 40% / cover`;

/** The same, from forest to navy, for the next-stage card. */
export const nextStageBackground = `linear-gradient(100deg, rgba(14, 59, 48, 0.96), rgba(10, 36, 64, 0.9)), url(${FOREST_IMAGE}) center / cover`;

/**
 * Plus Jakarta Sans once GC-9's `--font-heading` exists, the body font before.
 */
export const HEADING_FONT = "var(--font-heading, var(--font-roboto)), sans-serif";

export const rise = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
`;

export const fill = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`;

/** No entrance animation for users who ask for reduced motion. */
export const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

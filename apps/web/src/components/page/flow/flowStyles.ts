import { keyframes } from "@mui/material/styles";

// Shared look of the flow header and the next-stage card (mockup v2).

export const FLOW_COLORS = {
  /** Light green: completed stages and bars, on the dark header. */
  leaf: "#5cc08a",
  leafInk: "#06301f",
  /** Dark green: section icons, on light backgrounds (they need 3:1). */
  leafDark: "#2f8f5e",
  /**
   * The page eyebrow's 12 px text: 5.27:1 on white, 5.01:1 on the page background,
   * 4.98:1 on `blue25` and 4.82:1 on mint.
   */
  eyebrow: "#267a50",
  mint: "#eef7f1",
  forestInk: "#0e3b30",
  white: "#ffffff",
  /** Stage pages: blue accents, ink texts, hairlines and the page background. */
  blue: "#0d64a0",
  blue50: "#e8f1fa",
  blue25: "#f4f9fd",
  ink: "#0b2545",
  ink2: "#3d5873",
  muted: "#6b8299",
  line: "#e2ecf5",
  /** A primary button's hover. */
  blueDark: "#0a4f7e",
  /** A hovered card's border, between the hairline and the blue. */
  blueLine: "#b9d3e8",
  /** A field's or a framed button's border: 1.74:1 on white, as MUI's default. */
  fieldLine: "#b6c6d6",
  fieldLineHover: "#8aa3bb",
  /**
   * A choice not picked (the upload methods): muted like a disabled control. Its
   * texts keep 4.5:1 on `idleBackground`, and its icon 3:1 on `idleIconBackground`.
   */
  idleBackground: "#f5f7f9",
  idleLine: "#e6ebf0",
  idleTitle: "#56687a",
  idleText: "#5f7184",
  idleIconBackground: "#eceff3",
  idleIcon: "#7a8a99",
  pageBackground: "#f6faf8",
  ok: "#2e9e5b",
  okBackground: "#e3f4ea",
  warn: "#a85f00",
  warnBackground: "#fff1dc",
  bad: "#b83227",
  badBackground: "#fdeceb",
} as const;

/**
 * The height of a stage page's heading actions ("Cambiar capas", "Descargar"):
 * the same as the small search field beside them.
 */
export const PAGE_ACTION_HEIGHT = 40;

/** Width of the flow header's content (the stepper) and of a stage page's body. */
export const FLOW_CONTENT_MAX_WIDTH = 1180;

export const FOREST_IMAGE = "/images/aerial-river-rainforest.jpg";

/** Navy-to-forest gradient over the forest image, for the flow header. */
export const flowHeaderBackground = `linear-gradient(95deg, rgba(10, 36, 64, 0.94), rgba(14, 59, 48, 0.88)), url(${FOREST_IMAGE}) center 40% / cover`;

/** The same, from forest to navy, for the next-stage card. */
export const nextStageBackground = `linear-gradient(100deg, rgba(14, 59, 48, 0.96), rgba(10, 36, 64, 0.9)), url(${FOREST_IMAGE}) center / cover`;

/** The stage pages' background: faint leaf strokes on the page color. */
const LEAVES = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 220 220'%3E%3Cg fill='none' stroke='%232f8f5e' stroke-opacity='.06' stroke-width='1.2'%3E%3Cpath d='M30 190c40-60 40-120 0-170M60 190c40-60 40-120 0-170'/%3E%3Cpath d='M150 120c25-10 40-30 45-60-30 5-50 20-60 45M140 150c-20-20-45-25-75-15 15 25 40 35 70 30'/%3E%3C/g%3E%3C/svg%3E")`;
export const stagePageBackground = `${LEAVES} ${FLOW_COLORS.pageBackground}`;

/** A white card on a stage page. */
export const STAGE_CARD = {
  backgroundColor: FLOW_COLORS.white,
  border: `1px solid ${FLOW_COLORS.line}`,
  borderRadius: "14px",
  boxShadow: "0 1px 2px rgba(11, 37, 69, 0.05), 0 10px 30px rgba(11, 37, 69, 0.07)",
} as const;

/** A section heading's icon tile: mint, with the dark green icon (FlowSection). */
export const SECTION_ICON_TILE = {
  width: 38,
  height: 38,
  flex: "none",
  borderRadius: "10px",
  display: "grid",
  placeItems: "center",
  backgroundColor: FLOW_COLORS.mint,
  color: FLOW_COLORS.leafDark,
} as const;

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

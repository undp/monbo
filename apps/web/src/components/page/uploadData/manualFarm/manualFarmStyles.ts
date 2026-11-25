import { FLOW_COLORS } from "@/components/page/flow/flowStyles";

// The manual farm modal's look (mockup v2): the stage pages' colors, sentence-case
// buttons and rounder fields.

/** The paper of the modal and of its "How to draw" dialog. */
export const MODAL_PAPER = {
  borderRadius: "16px",
  boxShadow: "0 24px 60px rgba(11, 37, 69, 0.22)",
} as const;

/** A small uppercase label over a group of controls, as the "how to" panel's. */
export const EYEBROW = {
  margin: 0,
  fontSize: 11.5,
  fontWeight: 700,
  lineHeight: 1.4,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  // ink2, not muted: at this size the label needs 4.5:1, also on the blue panel
  color: FLOW_COLORS.ink2,
} as const;

const BUTTON = {
  textTransform: "none",
  borderRadius: "10px",
  fontWeight: 600,
  boxShadow: "none",
  whiteSpace: "nowrap",
} as const;

/** The main action: white on blue. */
export const PRIMARY_BUTTON = {
  ...BUTTON,
  backgroundColor: FLOW_COLORS.blue,
  "&:hover": { backgroundColor: FLOW_COLORS.blueDark, boxShadow: "none" },
} as const;

/** A secondary action: blue on white, with a hairline. */
export const SECONDARY_BUTTON = {
  ...BUTTON,
  color: FLOW_COLORS.blue,
  backgroundColor: FLOW_COLORS.white,
  border: `1px solid ${FLOW_COLORS.fieldLine}`,
  "&:hover": { borderColor: FLOW_COLORS.blue, backgroundColor: FLOW_COLORS.blue25 },
} as const;

/** A quiet action, with no frame (cancel, start over). */
export const TEXT_BUTTON = {
  ...BUTTON,
  fontWeight: 500,
  color: FLOW_COLORS.ink2,
  "&:hover": { backgroundColor: FLOW_COLORS.blue25 },
} as const;

/** An outlined text field: round corners, a border as MUI's default contrast, a blue focus. */
export const FIELD = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "10px",
    backgroundColor: FLOW_COLORS.white,
    "& fieldset": { borderColor: FLOW_COLORS.fieldLine },
    "&:hover fieldset": { borderColor: FLOW_COLORS.fieldLineHover },
    "&.Mui-focused fieldset": { borderColor: FLOW_COLORS.blue },
    // An error stays red, also while focused
    "&.Mui-error fieldset": { borderColor: FLOW_COLORS.bad },
  },
  "& .MuiInputLabel-root.Mui-focused": { color: FLOW_COLORS.blue },
  "& .MuiInputLabel-root.Mui-error": { color: FLOW_COLORS.bad },
  "& .MuiFormHelperText-root.Mui-error": { color: FLOW_COLORS.bad },
} as const;

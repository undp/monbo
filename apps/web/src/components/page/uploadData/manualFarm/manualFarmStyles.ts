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
  color: FLOW_COLORS.muted,
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
  "&:hover": { backgroundColor: "#0a4f7e", boxShadow: "none" },
} as const;

/** A secondary action: blue on white, with a hairline. */
export const SECONDARY_BUTTON = {
  ...BUTTON,
  color: FLOW_COLORS.blue,
  backgroundColor: FLOW_COLORS.white,
  border: "1px solid #c9d8e6",
  "&:hover": { borderColor: FLOW_COLORS.blue, backgroundColor: FLOW_COLORS.blue25 },
} as const;

/** A quiet action, with no frame (cancel, start over). */
export const TEXT_BUTTON = {
  ...BUTTON,
  fontWeight: 500,
  color: FLOW_COLORS.ink2,
  "&:hover": { backgroundColor: FLOW_COLORS.blue25 },
} as const;

/** An outlined text field: round corners, the flow's hairline and a blue focus. */
export const FIELD = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "10px",
    backgroundColor: FLOW_COLORS.white,
    "& fieldset": { borderColor: "#c9d8e6" },
    "&:hover fieldset": { borderColor: "#8aa3bb" },
    "&.Mui-focused fieldset": { borderColor: FLOW_COLORS.blue },
    // An error stays red, also while focused
    "&.Mui-error fieldset": { borderColor: FLOW_COLORS.bad },
  },
  "& .MuiInputLabel-root.Mui-focused": { color: FLOW_COLORS.blue },
  "& .MuiInputLabel-root.Mui-error": { color: FLOW_COLORS.bad },
  "& .MuiFormHelperText-root.Mui-error": { color: FLOW_COLORS.bad },
} as const;

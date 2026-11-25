import { FLOW_COLORS } from "@/components/page/flow/flowStyles";

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
